import type {
  GoToOptions,
  SliderConfig,
  SliderEvent,
  SliderEventData,
  SliderInstance,
} from "./types.ts";
import { autoplay, keyboard, navigation, pagination } from "./features.ts";

export const SLIDE_INDEX_ATTR = "data-aero-slider-index";
export const CLONE_ATTR = "data-aero-slider-clone";
const SLIDE_CLASS = "aero-slider__slide";
const FOCUSABLE =
  "a, area, button, input, select, textarea, iframe, summary, audio[controls], video[controls], embed, object, [contenteditable], [tabindex]";

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** The config as the slider holds it: every option set. */
export type Config = Required<SliderConfig>;

const DEFAULTS: Config = {
  loop: false,
  autoplay: false,
  autoplayInterval: 5000,
  autoplaySpeed: 40,
  draggable: true,
  alignment: "center",
  maxDots: 0,
  // Fields that are themselves dragged: a text selection, a range thumb. Media with controls is
  // left out: a browser keeps a press on its control bar to itself, so only the picture drags.
  noDrag: "input, textarea, select, [contenteditable]",
  perMove: 1,
  vertical: false,
  snap: "native",
  scrollDuration: 0,
  scrollEasing: easeOutCubic,
};

const CHOICES = {
  alignment: ["start", "center", "end"],
  snap: ["native", "settle", "none"],
} as const;

/** Lowest accepted value for each numeric option, and whether it must be a whole number. */
const NUMBERS = {
  perMove: [1, true],
  autoplayInterval: [100, false],
  autoplaySpeed: [-Infinity, false],
  maxDots: [0, true],
  scrollDuration: [0, false],
} as const;

/**
 * Merges `changes` into `config`, skipping undefined keys. A value of the wrong kind, a
 * non-finite number or an unknown string falls back to the default; numbers are raised to their
 * minimum. Never throws: a bad option shouldn't take the page down.
 */
function configure(config: Config, changes: SliderConfig = {}): void {
  const target = config as Record<string, unknown>;
  for (const [key, value] of Object.entries(changes ?? {})) {
    if (value !== undefined) target[key] = value;
  }
  for (const [key, [min, whole]] of Object.entries(NUMBERS)) {
    // Theme scripts often pass numbers straight from data attributes, as strings.
    const raw = target[key];
    const value = typeof raw === "string" ? parseFloat(raw) : (raw as number);
    target[key] = Number.isFinite(value)
      ? Math.max(min, whole ? Math.trunc(value) : value)
      : DEFAULTS[key as keyof typeof NUMBERS];
  }
  for (const [key, values] of Object.entries(CHOICES)) {
    if (!(values as readonly unknown[]).includes(target[key])) {
      target[key] = DEFAULTS[key as keyof typeof CHOICES];
    }
  }
  if (typeof config.scrollEasing !== "function") config.scrollEasing = DEFAULTS.scrollEasing;
}

const DRAG_THRESHOLD_PX = 5;
const FLICK_VELOCITY = 0.3; // px per ms
const FLICK_PROJECTION_MS = 250;
const SETTLE_FALLBACK_MS = 150; // for browsers without the scrollend event
const WHEEL_SETTLE_MS = 200; // Firefox can skip scrollend after wheel scrolling

/**
 * What a re-measure follows, which decides where the track goes. `resize`: the layout changed under
 * the track, which rests on the same slide at its new position. `scroll`: a user's scroll ended on
 * positions since found stale, so the index becomes the slide the track rests on. `move`: a goTo()
 * ended there, so the index stays and the track eases the rest of the way onto that slide.
 * `input`: a press, touch or wheel took over since, so the track and the index are left to it.
 */
type Remeasure = "resize" | "scroll" | "move" | "input";

/** What the UI features (nav, dots, keyboard, autoplay) need from the core. */
export interface SliderCore {
  container: HTMLElement;
  track: HTMLElement;
  config: Config;
  signal: AbortSignal;
  reducedMotion: MediaQueryList;
  /** A scrollDuration animation is in flight. */
  easing(): boolean;
  current(): number;
  /** How many distinct places the track rests at: every slide on a loop, fewer where ends clamp. */
  stopCount(): number;
  /** The stop the current slide rests on. */
  stop(): number;
  /** The first slide that rests on stop `n`. */
  slideOfStop(n: number): number;
  loop(): boolean;
  next(): void;
  prev(): void;
  goTo(index: number, options?: GoToOptions): void;
  emit<E extends SliderEvent>(event: E, data: SliderEventData<E>): void;
  // What continuous autoplay needs to drive the track by hand.
  isVertical(): boolean;
  isRtl(): boolean;
  position(): number;
  maxScroll(): number;
  jumpTo(position: number): void;
  /** One full lap of real slides: where its teleport-safe band starts, and its length. */
  cycle(): { start: number; width: number } | null;
}

function requireTrack(container: HTMLElement): HTMLElement {
  const track = container.querySelector<HTMLElement>(".aero-slider__track");
  if (!track) throw new Error("aero-slider: missing .aero-slider__track");
  if (!track.children.length) throw new Error("aero-slider: no slides found");
  return track;
}

export function createSlider(
  container: HTMLElement,
  userConfig: SliderConfig = {}
): SliderInstance {
  container.aeroSlider?.destroy();
  const track = requireTrack(container);

  const config = { ...DEFAULTS };
  configure(config, userConfig);
  const controller = new AbortController();
  const { signal } = controller;

  let slides: HTMLElement[] = [];
  const classed = new WeakSet<Element>(); // slides that got SLIDE_CLASS from us, not their author
  let slideCount = 0;
  let current = 0;
  let destroyed = false;
  let ready = false; // autoplay waits for the ready event before it starts
  let rtl = false; // read from the computed direction on every rebuild, so refresh() updates it

  // Layout metrics, refreshed by measure()
  let slidesPerView = 1;
  let clonesBefore = 0; // loop clones prepended ahead of the real slides
  let slideStride = 0; // distance between neighbouring snap positions; 0 until laid out
  let firstSnapPosition = 0; // snap position of track.children[0]
  // Snap position of every track child, clones included. Slides can differ in width, so nothing
  // derives these from the stride. Moving the track reads them and never the DOM: a read there
  // would force a layout of the page whenever a slideChange handler had just changed it.
  let snaps: number[] = [];
  let maxScroll = 0;
  let paddingStart = 0; // track padding doubles as scroll-padding (see slider.css)
  let paddingEnd = 0;
  // The first slide at each distinct rest position, and those positions. On a loop, every slide.
  let stops: number[] = [];
  let stopPositions: number[] = [];

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  // Clones are made here, where nothing loads: cloning a live lazy image can start its fetch.
  const inertDocument = document.implementation.createHTMLDocument("");

  // Scroll state
  let programmaticScroll = false; // a goTo() animation is in flight
  let moveSmooth = true; // how that move scrolls, which a move correcting it keeps
  let coasting = false; // that move is a free drag's release coasting on, not a goTo()
  let scrollTarget = 0; // where that animation is headed
  let dragging = false;
  let suppressNextClick = false;
  let scrollFrame = 0;
  let settleTimer = 0;
  let easeFrame = 0; // a scrollDuration animation is in flight
  let moveFrame = 0; // a smooth move is waiting for the next frame to start
  // The scroll offset as last read, until something can have moved the track. Reading it lays the
  // page out if anything changed since the last frame, as it has in most slideChange handlers.
  let knownPosition: number | undefined;
  let fallbackSettle = false; // a wheel or touch moved the track and scrollend may never come
  const pressed = new Set<number>(); // mouse and pen pointers down on the track
  // Fingers on the track, from touch events: a pan turns the pointer stream into pointercancel
  // while the finger is still down, so pointer events can't say when it lifts.
  const touches = new Set<number>();
  let settleDeferred = false; // a settle arrived while a pointer or finger was still down

  const isVertical = () => config.vertical;
  const isRtl = () => rtl;
  const computedRtl = () => !isVertical() && getComputedStyle(container).direction === "rtl";
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
  const wrap = (index: number) => ((index % slideCount) + slideCount) % slideCount;

  function maxIndex(): number {
    const pagesByStart = config.alignment === "start" && Number.isInteger(slidesPerView);
    return Math.max(0, pagesByStart ? slideCount - slidesPerView : slideCount - 1);
  }
  const continuous = () => config.autoplay === "continuous";
  // Continuous autoplay loops by nature and moves the track by hand, so snapping stays off. Any
  // other loop needs slides to overflow the view, or its clones would sit beside the real ones.
  const loop = () => (continuous() ? slideCount > 1 : config.loop && slideCount > slidesPerView);
  const snapMode = () => (continuous() ? "none" : config.snap);
  // A continuous lap travels one full set of slides past wherever it starts, so it needs a whole
  // set of clones beyond the real slides plus a viewport's worth.
  const cloneCount = () =>
    !loop()
      ? 0
      : continuous()
        ? slideCount + Math.ceil(slidesPerView) + 2
        : Math.max(slideCount, Math.ceil(slidesPerView) + 2);

  function emit<E extends SliderEvent>(event: E, detail: SliderEventData<E>): void {
    container.dispatchEvent(new CustomEvent(`aero:${event}`, { detail, bubbles: true }));
  }

  // ── Geometry ─────────────────────────────────────────────────────────
  // Positions are logical: 0 at the start edge, growing toward the end, in
  // every direction. RTL maps onto the negative scrollLeft browsers use.

  function scrollPosition(): number {
    if (knownPosition === undefined) {
      knownPosition = isVertical()
        ? track.scrollTop
        : isRtl()
          ? -track.scrollLeft
          : track.scrollLeft;
    }
    return knownPosition;
  }
  const forgetPosition = () => (knownPosition = undefined);

  function nativeScrollTo(position: number, behavior: ScrollBehavior): void {
    if (isVertical()) track.scrollTo({ top: position, behavior });
    else track.scrollTo({ left: isRtl() ? -position : position, behavior });
    forgetPosition();
    // The browser clamps and rounds the offset. It has just laid the page out, so reading it back
    // costs nothing, and the next goTo() need not.
    if (behavior === "instant") scrollPosition();
  }

  /** Drops a scripted move the browser has not been handed yet: one waiting to start, or easing. */
  function cancelEase(): void {
    cancelAnimationFrame(moveFrame);
    moveFrame = 0;
    if (!easeFrame) return;
    cancelAnimationFrame(easeFrame);
    easeFrame = 0;
    track.style.scrollSnapType = "";
  }

  /** Smooth scrolls honour prefers-reduced-motion, and use scrollDuration's easing when set. */
  function scrollTo(position: number, smooth = false): void {
    if (!smooth || reducedMotion.matches) {
      cancelEase();
      return nativeScrollTo(position, "instant");
    }
    if (config.scrollDuration <= 0) {
      cancelEase();
      // Scrolling lays the page out first, and goTo() often runs in a slideChange handler that has
      // just changed it. A frame on, that layout is done, and the move looks no different.
      moveFrame = requestAnimationFrame(() => {
        moveFrame = 0;
        nativeScrollTo(position, reducedMotion.matches ? "instant" : "smooth");
      });
      return;
    }
    // Snapping stays off from one eased move into the next: restoring it in between would let
    // the browser snap the track to a slide before this move reads where it starts.
    cancelAnimationFrame(moveFrame);
    moveFrame = 0;
    cancelAnimationFrame(easeFrame);
    track.style.scrollSnapType = "none"; // mandatory snapping would pull every frame to a slide
    const from = scrollPosition();
    const distance = position - from;
    const started = performance.now();
    const step = (now: number) => {
      // Frame timestamps can predate `started`, so clamp before easing.
      const t = Math.min(1, Math.max(0, (now - started) / config.scrollDuration));
      nativeScrollTo(from + distance * config.scrollEasing(t), "instant");
      easeFrame = t < 1 ? requestAnimationFrame(step) : 0;
      if (!easeFrame) track.style.scrollSnapType = "";
    };
    easeFrame = requestAnimationFrame(step);
  }

  /**
   * Reads, for every track child, the scroll position at which it rests on its snap point,
   * honouring alignment and scroll-padding. Only measure() and relayout() read the DOM this way.
   */
  function readSnaps(): number[] {
    const trackRect = track.getBoundingClientRect();
    const [axisStart, axisSize] = isVertical()
      ? [trackRect.top + track.clientTop, track.clientHeight]
      : isRtl() // mirror x so "start" is the right edge
        ? [-(trackRect.left + track.clientLeft + track.clientWidth), track.clientWidth]
        : [trackRect.left + track.clientLeft, track.clientWidth];
    const snapportStart = axisStart + paddingStart;
    const snapportEnd = axisStart + axisSize - paddingEnd;
    const position = scrollPosition();
    return Array.from(track.children, (el) => {
      const rect = el.getBoundingClientRect();
      const [elStart, elEnd] = isVertical()
        ? [rect.top, rect.bottom]
        : isRtl()
          ? [-rect.right, -rect.left]
          : [rect.left, rect.right];
      const delta =
        config.alignment === "start"
          ? elStart - snapportStart
          : config.alignment === "end"
            ? elEnd - snapportEnd
            : (elStart + elEnd - snapportStart - snapportEnd) / 2;
      return position + delta;
    });
  }

  // The track's size and scroll range along its axis, which scrolling may read every frame.
  const extent = () =>
    isVertical()
      ? `${track.clientHeight},${track.scrollHeight}`
      : `${track.clientWidth},${track.scrollWidth}`;
  let seenExtent = ""; // the extent the layout was measured at
  /**
   * True while the track's extent differs from the one measured. A resize can move the scroll
   * offset before the observer re-measures, so the caller leaves the index alone until a
   * re-measure places it.
   */
  function extentChanged(): boolean {
    if (extent() === seenExtent) return false;
    forgetPosition(); // a narrower track clamps its offset
    return true;
  }

  let remeasureQueued = false;
  // A press, touch or wheel on the track sets "input": a re-measure queued before it must not move
  // the track out from under the input.
  let remeasureAfter: Remeasure = "scroll";
  /**
   * Re-measures after a change no observer reports: a new gap between fixed-width slides resizes
   * no element, and only the track's scroll range shows it. Called once the track rests, so it
   * never moves the track under a scroll.
   */
  function remeasureUnobserved(after: Remeasure): void {
    remeasureAfter = after;
    if (remeasureQueued) return;
    remeasureQueued = true;
    // The observer delivers after layout, which a settle can precede. Two frames on it has had
    // its turn, and whatever it re-measured no longer differs.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        remeasureQueued = false;
        if (!destroyed && extent() !== seenExtent) resized(remeasureAfter);
      })
    );
  }

  function readSlidesPerView(): void {
    const style = getComputedStyle(container);
    slidesPerView = parseFloat(style.getPropertyValue("--aero-slides-per-view")) || 1;
  }

  function measure(): void {
    forgetPosition();
    const style = getComputedStyle(track);
    if (isVertical()) {
      paddingStart = parseFloat(style.paddingTop);
      paddingEnd = parseFloat(style.paddingBottom);
    } else {
      paddingStart = parseFloat(isRtl() ? style.paddingRight : style.paddingLeft);
      paddingEnd = parseFloat(isRtl() ? style.paddingLeft : style.paddingRight);
    }
    const axisSize = isVertical() ? track.clientHeight : track.clientWidth;
    snaps = readSnaps();
    seenExtent = extent();
    firstSnapPosition = snaps[0] ?? 0;
    slideStride = snaps.length > 1 ? snaps[1]! - firstSnapPosition : axisSize; // 0 under display: none
    maxScroll = isVertical()
      ? track.scrollHeight - track.clientHeight
      : track.scrollWidth - track.clientWidth;
    stops = [];
    stopPositions = [];
    for (let i = 0; i < slideCount && (loop() || i <= maxIndex()); i++) {
      const position = loop() ? 0 : restPositionOf(i);
      // Unmeasured (display: none), every slide reads 0; keep them all until relayout() measures.
      if (i && slideStride && !loop() && position - stopPositions[stopPositions.length - 1]! < 0.5)
        continue;
      stops.push(i);
      stopPositions.push(position);
    }
  }

  // ── Indexing ─────────────────────────────────────────────────────────
  // "DOM index" counts track children including clones; "index" is the
  // logical slide number the public API speaks in.

  /**
   * The DOM index resting nearest `position`. Slides can differ in width, so it is looked up and
   * not divided out. A position past either end of the track (a drag or a flick can project one)
   * counts on from that end in strides.
   */
  function domIndexAt(position: number): number {
    const last = snaps.length - 1;
    if (!(position > snaps[0]!)) return Math.round((position - firstSnapPosition) / slideStride);
    if (!(position < snaps[last]!))
      return last + Math.round((position - snaps[last]!) / slideStride);
    let nearest = 0;
    for (let i = 1; i <= last; i++) {
      // On a tie the later one wins, as rounding a half up would have it.
      if (Math.abs(snaps[i]! - position) <= Math.abs(snaps[nearest]! - position)) nearest = i;
    }
    return nearest;
  }
  const isRealDomIndex = (domIndex: number) =>
    domIndex >= clonesBefore && domIndex < clonesBefore + slideCount;
  const indexOfDom = (domIndex: number) =>
    loop() ? wrap(domIndex - clonesBefore) : clamp(domIndex, 0, maxIndex());

  /** The slide resting nearest `position`: on a loop any slide, otherwise the slide of a stop. */
  function indexAt(position: number): number {
    if (loop()) return indexOfDom(domIndexAt(position));
    const distance = (stop: number) => Math.abs(stopPositions[stop]! - position);
    const nearest = stops.reduce(
      (best, _, stop) => (distance(stop) < distance(best) ? stop : best),
      0
    );
    return stops[nearest] ?? 0;
  }

  // The last stop at or before the slide. Stops ascend, so counting them finds it.
  const stopOf = (index: number) => stops.filter((slide) => slide <= index).length - 1;

  /** Where the real copy of slide `index` rests. */
  function restPositionOf(index: number): number {
    const position = snaps[clonesBefore + index] ?? 0; // every slide removed
    return loop() ? position : clamp(position, 0, maxScroll);
  }

  function setCurrent(index: number): void {
    if (index === current) return;
    current = index;
    emit("slideChange", { index });
    dots.refresh();
    nav.refresh();
  }

  // ── Loop ─────────────────────────────────────────────────────────────
  // Clones on both sides give native scrolling room to run past the ends.
  // Once a scroll settles on a clone we jump to its real twin; the two look
  // identical so the jump is invisible.

  function shiftToRealCopy(domIndex: number): number {
    return snaps[clonesBefore + wrap(domIndex - clonesBefore)]! - snaps[domIndex]! || 0;
  }

  function teleportToRealSlides(): void {
    if (!loop()) return;
    const domIndex = domIndexAt(scrollPosition());
    if (!isRealDomIndex(domIndex)) scrollTo(scrollPosition() + shiftToRealCopy(domIndex));
  }

  /** One lap of real slides on a loop: the distance from a slide to its next copy. */
  function cycleWidth(): number {
    return snaps[clonesBefore + slideCount]! - snaps[clonesBefore]! || 0;
  }

  /**
   * Starts a programmatic move. The browser clamps scrolling to the runway, so the target is
   * clamped too; otherwise onSettle() would wait forever for a spot the track can't reach.
   */
  function startMove(target: number, smooth = true): void {
    moveSmooth = smooth;
    coasting = false;
    programmaticScroll = true;
    scrollTarget = clamp(target, 0, maxScroll);
    scrollTo(scrollTarget, smooth);
  }

  function cloneOf(slide: HTMLElement): HTMLElement {
    const clone = inertDocument.importNode(slide, true);
    clone.removeAttribute(SLIDE_INDEX_ATTR);
    clone.setAttribute(CLONE_ATTR, "");
    clone.setAttribute("aria-hidden", "true");
    // A clone looks, plays and clicks like its slide but stays out of the tab order, forms and
    // labels; an image map in it is only a picture. The slide itself can be a link (a card). A
    // required control without its name is a group of its own, never filled in: it would block
    // the form it sits in, so a clone is not required either.
    for (const el of [clone, ...clone.querySelectorAll<HTMLElement>("*")]) {
      for (const name of ["id", "name", "for", "form", "usemap", "required"])
        el.removeAttribute(name);
      if (el.matches(FOCUSABLE)) el.tabIndex = -1;
    }
    return clone;
  }

  /** With several slides in view, the outermost clones rest past the scrollable range. */
  const reachable = (position: number) => position >= -1 && position <= maxScroll + 1;
  /** Where each copy of slide `index` the track can reach rests. */
  const copiesOf = (index: number) =>
    snaps.filter((position, domIndex) => indexOfDom(domIndex) === index && reachable(position));
  const nearest = (positions: number[], to: number) =>
    positions.reduce((a, b) => (Math.abs(b - to) < Math.abs(a - to) ? b : a));

  /**
   * Steps queued faster than the track moves can run a lap or more past the reachable clones. Head for the
   * copy of `index` nearest the track in direction `dir` instead; extra laps would only spin past.
   * With no copy left ahead, hop the track a lap back first: the copies look identical, and a lap
   * from the runway's far end stays on it. Mid-move the track sits between slides, where mandatory
   * snapping would pull the hop, so snapping stays off until the move settles.
   */
  function headFor(index: number, dir: number): number {
    // No direction (a zero step onto an unreachable copy): the nearest reachable copy will do.
    if (!dir) return nearest(copiesOf(index), scrollPosition());
    const copiesAhead = (position: number) =>
      copiesOf(index).filter((p) => (dir > 0 ? p > position + 1 : p < position - 1));
    let ahead = copiesAhead(scrollPosition());
    if (!ahead.length) {
      cancelEase();
      track.style.scrollSnapType = "none";
      scrollTo(scrollPosition() - dir * cycleWidth());
      ahead = copiesAhead(scrollPosition());
    }
    return dir > 0 ? Math.min(...ahead) : Math.max(...ahead);
  }

  // ── Navigation ───────────────────────────────────────────────────────

  /** `towards` is the sign of a next()/prev() step: it picks the way round when both are equally short. */
  function goTo(index: number, options: GoToOptions = {}, towards = 0): void {
    if (destroyed || !slideCount || !Number.isFinite(index)) return;
    // Continuous autoplay hands its lap back to the scroll offset before we measure from it.
    play.interrupt();
    const logical = loop() ? wrap(Math.trunc(index)) : clamp(Math.trunc(index), 0, maxIndex());
    setCurrent(logical);
    if (!slideStride) return; // no layout yet (display: none); relayout() lands here once shown
    let target: number;
    if (loop()) {
      // Step from where a move in flight is headed, not from where it has got to: with few slides,
      // a move short of halfway still rounds to the slide it is leaving, which can be the new target.
      const inFlight = programmaticScroll;
      if (!inFlight) teleportToRealSlides();
      const from = inFlight ? scrollTarget : scrollPosition();
      const fromDom = domIndexAt(from);
      const forward = wrap(logical - indexOfDom(fromDom));
      const back = forward * 2 > slideCount || (forward * 2 === slideCount && towards < 0);
      const steps = back ? forward - slideCount : forward;
      const queuedAt = snaps[fromDom + steps] ?? NaN;
      target = reachable(queuedAt) ? queuedAt : headFor(logical, Math.sign(steps));
    } else {
      target = restPositionOf(logical);
    }
    if (Math.abs(target - scrollPosition()) < 1) {
      // Already there, but a move started a moment ago may still be headed elsewhere: stop it.
      if (programmaticScroll) scrollTo(target);
      programmaticScroll = false;
      return onSettle(false);
    }
    startMove(target, !options.instant);
  }

  /** Steps from the slide that's showing: a continuous lap hands back first, so sync to it. */
  function stepBy(delta: number): void {
    if (play.interrupt()) setCurrent(indexAt(scrollPosition()));
    if (loop()) goTo(current + delta, {}, delta);
    else goTo(stops[clamp(stopOf(current) + delta, 0, stops.length - 1)]!);
  }
  const next = () => stepBy(config.perMove);
  const prev = () => stepBy(-config.perMove);

  // ── Scroll tracking ──────────────────────────────────────────────────

  function onScroll(): void {
    forgetPosition();
    play.scrolled();
    if (!programmaticScroll && !scrollFrame) {
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        // A goTo() since this frame was queued (a drag's release) has already set the index. A
        // resize can clamp the offset before the observer re-measures; relayout() places it then.
        if (programmaticScroll || extentChanged()) return;
        const position = scrollPosition();
        // Several slides can share a stop; a scroll that stays on it keeps the one that was asked for.
        if (loop() || Math.abs(position - stopPositions[stopOf(current)]!) > 1) {
          setCurrent(indexAt(position));
        }
      });
    }
    if (!("onscrollend" in track) || fallbackSettle) {
      clearTimeout(settleTimer);
      settleTimer = window.setTimeout(
        onSettle,
        fallbackSettle ? WHEEL_SETTLE_MS : SETTLE_FALLBACK_MS
      );
    }
  }

  /** `scrolled` is false when goTo() found the track already in place: nothing there may read layout. */
  function settleSoon(): void {
    clearTimeout(settleTimer);
    settleTimer = window.setTimeout(onSettle, WHEEL_SETTLE_MS);
  }

  function onSettle(scrolled = true): void {
    if (dragging) return;
    clearTimeout(settleTimer);
    fallbackSettle = false;
    // A pointer still down owns the track: a finger may still be scrolling it, and a teleport now
    // would swap the pressed card for its copy, so a click would miss the link. Settle on release.
    if (pressed.size || touches.size) {
      settleDeferred = true;
      return;
    }
    // A resize can settle before the observer re-measures: the re-measure then places the track
    // and the index, which the stale positions here would get wrong.
    const stale = scrolled && extentChanged();
    // A coast is the user's scroll carried on, so it is followed like one.
    if (stale) remeasureUnobserved(programmaticScroll && !coasting ? "move" : "scroll");
    // A scrollend from an instant scroll issued just before goTo() lands mid-animation; wait for ours.
    if (programmaticScroll && Math.abs(scrollPosition() - scrollTarget) > 1) return;
    const userScroll = !programmaticScroll;
    programmaticScroll = false;
    track.style.scrollSnapType = "";
    // Native snapping normally has the track on a slide by now, and settleNear() then does
    // nothing. WebKit doesn't re-snap when an interrupted eased move restores snapping.
    if (userScroll && !stale && snapMode() !== "none" && settleNear(scrollPosition())) return;
    // Stale positions can take a real slide for a clone; the re-measure rests on the real copy.
    if (!stale) teleportToRealSlides();
    const position = scrollPosition();
    const landed = indexAt(position);
    // A clamped edge can park several indices at one spot; keep the requested one there.
    const moved = loop() || Math.abs(position - restPositionOf(current)) > 1;
    if (landed !== current && moved && !stale) setCurrent(landed);
    play.settled();
  }

  /**
   * Eases onto track.children[domIndex]. On a loop, a clone whose snap point lies off the runway
   * (fractional slides per view put the end clones there) is swapped for its real twin: the track
   * first jumps by the same distance, which looks identical, so nothing visibly flies across.
   */
  function settleOnto(domIndex: number): void {
    let target = snaps[domIndex]!;
    if (target < -1 || target > maxScroll + 1) {
      const shift = shiftToRealCopy(domIndex);
      scrollTo(scrollPosition() + shift);
      target += shift;
    }
    setCurrent(indexOfDom(domIndex));
    startMove(target);
  }

  /**
   * snap: "settle" — ease onto the slide nearest `position` (where the track is, or where a
   * release would carry it). On a loop that can be a clone on screen; the clone→real teleport runs
   * once the ease lands, so the track never flies back across to the real copy. Returns false when
   * it's already resting there.
   */
  function settleNear(position: number): boolean {
    if (!slideStride) return false;
    if (!loop()) {
      const index = indexAt(clamp(position, 0, maxScroll));
      const target = restPositionOf(index);
      if (Math.abs(target - scrollPosition()) <= 1) return false;
      setCurrent(index);
      startMove(target);
      return true;
    }
    const domIndex = clamp(domIndexAt(position), 0, track.children.length - 1);
    if (Math.abs(snaps[domIndex]! - scrollPosition()) <= 1) return false;
    settleOnto(domIndex);
    return true;
  }

  /** How far a release at `velocity` carries; on a loop, never a full lap, so a shift keeps it on the runway. */
  function projection(velocity: number): number {
    const distance = velocity * FLICK_PROJECTION_MS;
    if (!loop()) return distance;
    const limit = Math.max(0, cycleWidth() - slideStride);
    return clamp(distance, -limit, limit);
  }

  // ── Mouse / pen drag ─────────────────────────────────────────────────
  // Touch scrolls natively. For other pointers we move the scroller by hand
  // with snapping off, then release into a smooth scroll the way a fling would.

  function onPointerDown(event: PointerEvent): void {
    suppressNextClick = false;
    programmaticScroll = false; // a press takes over from any goTo() animation
    remeasureAfter = "input";
    // Fingers are counted from touch events (see touchstart below).
    if (event.pointerType !== "touch") pressed.add(event.pointerId);
    // A wheel settle that was still pending waits for the pointer or finger to lift. So does the
    // settle a move owes when the press stops it short, or before it starts.
    if (fallbackSettle || easeFrame || moveFrame) settleDeferred = true;
    fallbackSettle = false;
    clearTimeout(settleTimer);
    cancelEase();
    if (!config.draggable || event.button !== 0 || event.pointerType === "touch") return;
    if (config.noDrag && (event.target as Element).closest(config.noDrag)) return;

    const axis = isVertical() ? "clientY" : "clientX";
    const direction = isRtl() ? -1 : 1;
    const startCoord = event[axis];
    const fromIndex = current;
    const gesture = new AbortController();
    let startScroll = scrollPosition();
    let lastCoord = startCoord;
    let lastTime = event.timeStamp;
    let velocity = 0; // px per ms along the logical axis

    function onMove(move: PointerEvent): void {
      // No button held: the release landed where this window can't hear it (an iframe).
      if (!(move.buttons & 1)) return onUp(move);
      // Another slider (a parent or a child) captured this pointer for its own drag. Content that
      // holds it (a browser's implicit capture for pen) still drags this one.
      const target = move.target as Element;
      if (
        target !== track &&
        target.matches?.(".aero-slider__track") &&
        target.hasPointerCapture(move.pointerId)
      ) {
        return onUp(move);
      }
      const coord = move[axis];
      if (!dragging) {
        if (Math.abs(coord - startCoord) < DRAG_THRESHOLD_PX) return;
        dragging = true;
        suppressNextClick = true;
        track.setPointerCapture(move.pointerId);
        track.style.scrollSnapType = "none";
        container.classList.add("aero-slider--dragging");
        play.hold("drag");
        emit("dragStart", { index: fromIndex });
      }
      const elapsed = move.timeStamp - lastTime;
      if (elapsed > 0) {
        const instant = ((lastCoord - coord) * direction) / elapsed;
        velocity = elapsed < 100 ? 0.3 * instant + 0.7 * velocity : velocity / 2;
        lastCoord = coord;
        lastTime = move.timeStamp;
      }
      let position = startScroll + (startCoord - coord) * direction;
      if (loop()) {
        const domIndex = domIndexAt(position);
        if (!isRealDomIndex(domIndex)) {
          const shift = shiftToRealCopy(domIndex);
          position += shift;
          startScroll += shift;
        }
      }
      // Scroll now, not in rAF: scroll-driven animations sample the offset before rAF callbacks,
      // so a lap shift scrolled from rAF would paint them a lap away for one frame.
      scrollTo(position);
    }

    function onUp(up: PointerEvent): void {
      gesture.abort();
      if (!dragging) return;
      dragging = false;
      container.classList.remove("aero-slider--dragging");
      const idle = up.timeStamp - lastTime;
      if (idle > 50) velocity *= Math.max(0, 1 - idle / 200);

      if (snapMode() !== "native") {
        const position = scrollPosition();
        let rest = position + projection(velocity);
        if (snapMode() === "settle") {
          // Coast on the release velocity, then ease onto the slide nearest where that ends.
          if (!settleNear(rest)) onSettle();
        } else {
          // No snapping: coast and rest wherever that ends. On a loop, shift a lap first if the
          // coast would run off the runway (a lap away looks identical).
          if (loop() && (rest < 0 || rest > maxScroll)) {
            const shift = rest > maxScroll ? -cycleWidth() : cycleWidth();
            scrollTo(position + shift);
            rest += shift;
          }
          if (Math.abs(rest - scrollPosition()) > 1) {
            startMove(rest);
            coasting = true;
          } else onSettle();
        }
        emit("dragEnd", { index: current, fromIndex });
        play.release("drag");
        return;
      }

      // Like native paging: a flick always moves at least one slide (one stop, off a loop) its way.
      const position = scrollPosition();
      const projected = position + velocity * FLICK_PROJECTION_MS;
      const flick = Math.abs(velocity) > FLICK_VELOCITY ? Math.sign(velocity) : 0;
      if (loop()) {
        const domTarget = domIndexAt(projected);
        goTo(indexOfDom(domTarget + (domTarget === domIndexAt(position) ? flick : 0)));
      } else {
        const stop = stopOf(indexAt(projected));
        const nudge = stop === stopOf(indexAt(position)) ? flick : 0;
        goTo(stops[clamp(stop + nudge, 0, stops.length - 1)]!);
      }
      emit("dragEnd", { index: current, fromIndex });
      play.release("drag");
    }

    // On window: until the drag threshold captures the pointer, a move or release off the track
    // never reaches it, and a gesture left open would drag on the next hover. Capture phase, so
    // an ancestor that stops the event can't keep it from us either.
    const options = { signal: gesture.signal };
    const windowOptions = { ...options, capture: true };
    const own = (handler: (e: PointerEvent) => void) => (e: PointerEvent) =>
      e.pointerId === event.pointerId && handler(e);
    addEventListener("pointermove", own(onMove), windowOptions);
    addEventListener("pointerup", own(onUp), windowOptions);
    addEventListener("pointercancel", own(onUp), windowOptions);
    signal.addEventListener("abort", () => gesture.abort(), options);
  }

  function onClick(event: MouseEvent): void {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    event.preventDefault();
    event.stopPropagation();
  }

  // ── Observers ────────────────────────────────────────────────────────

  // The size of the track and of every track child when the layout was last measured. The first
  // callback after observe() may already carry a change (no frame ran in between), so compare
  // rather than skip it. Computed sizes keep their fractions, which clientWidth rounds away: a
  // 0.4px change to each of 100 slides moves the last one 40px.
  const measuredSizes = new Map<Element, string>();
  const sizeOf = (el: Element) => {
    const style = getComputedStyle(el);
    return `${style.width},${style.height}`;
  };
  // The observer calls back after layout, so the reads here and in relayout() force nothing.
  const resizeObserver = new ResizeObserver((entries) => {
    if (destroyed) return;
    let changed = false;
    for (const { target } of entries) {
      const size = sizeOf(target);
      // A rebuild earlier in this delivery may have dropped the target.
      if (!measuredSizes.has(target) || measuredSizes.get(target) === size) continue;
      measuredSizes.set(target, size);
      changed = true;
    }
    if (changed) resized();
  });

  function resized(after: Remeasure = "resize"): void {
    emit("resize", {});
    relayout(after);
    emit("resized", {});
  }

  let intersectionObserver: IntersectionObserver | undefined;
  const intersecting = new Map<Element, boolean>();
  let visibleIndices = new Set<number>();

  function onIntersection(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) intersecting.set(entry.target, entry.isIntersecting);
    const children = Array.from(track.children);
    const nowVisible = new Set<number>();
    for (const [el, isIn] of intersecting) {
      // The slide itself (or the one a clone copies), not the clamped index navigation would use.
      if (isIn) nowVisible.add(wrap(children.indexOf(el) - clonesBefore));
    }
    for (const index of visibleIndices) if (!nowVisible.has(index)) emit("hidden", { index });
    for (const index of nowVisible) if (!visibleIndices.has(index)) emit("visible", { index });
    visibleIndices = nowVisible;
  }

  function observe(): void {
    // A later slide can change size alone (an image loads, a font swaps), and the track's own box
    // stays the same when it does: the track scrolls, so only its scroll width grows.
    resizeObserver.disconnect();
    measuredSizes.clear();
    for (const el of [track, ...track.children]) {
      measuredSizes.set(el, sizeOf(el));
      resizeObserver.observe(el);
    }

    intersectionObserver?.disconnect();
    intersecting.clear();
    intersectionObserver = new IntersectionObserver(onIntersection, {
      root: track,
      rootMargin: isVertical() ? "-1px 0px" : "0px -1px", // ignore sub-pixel bleed from neighbours
    });
    for (const child of track.children) intersectionObserver.observe(child);
  }

  // ── Layout ───────────────────────────────────────────────────────────

  /** Cheap path for size changes: re-measure and keep the current slide in place (see Remeasure). */
  function relayout(after: Remeasure = "resize"): void {
    const previousStops = stops.join();
    let index = current;
    // The index doesn't follow a continuous drift, so keep the slide that's actually showing.
    // Its box includes the drift, so the slide resting nearest the scroll offset is the one on screen.
    if (play.drifting()) {
      const position = scrollPosition();
      const distances = readSnaps().map((snap) => Math.abs(snap - position));
      index = indexOfDom(distances.indexOf(Math.min(...distances)));
      after = "resize";
    }
    play.reset(); // continuous autoplay's transforms would skew every measurement
    readSlidesPerView();
    if (cloneCount() !== clonesBefore) return rebuild(index);
    measure();
    if (stops.join() !== previousStops) dots.build();
    else dots.measure();
    nav.refresh();
    if (after === "move") return glideTo(index);
    if (after === "input") {
      // The input's settle places the index. A press that never moves the track has none to come,
      // so one is owed on its release, or now if it has already lifted.
      if (pressed.size || touches.size) settleDeferred = true;
      else settleSoon();
      return play.start();
    }
    // A coast whose target a narrower track no longer reaches never settled: it ends here.
    if (after === "scroll" && coasting) programmaticScroll = coasting = false;
    const follow = after === "scroll" && !programmaticScroll;
    const position = scrollPosition();
    // A clamped edge can park several indices at one spot; keep the current one there.
    if (follow && (loop() || Math.abs(position - restPositionOf(index)) > 1))
      index = indexAt(position);
    if (follow && snapMode() === "none") {
      // Free scrolling rests wherever a scroll stops: keep that offset, on a loop's real slides.
      teleportToRealSlides();
      setCurrent(index);
    } else rest(index);
    play.start();
  }

  /**
   * Eases the rest of the way onto slide `index`, after a move that ended on positions since found
   * stale. A loop eases onto the copy nearest the track, never a lap across.
   */
  function glideTo(index: number): void {
    const position = scrollPosition();
    const target = nearest(loop() ? copiesOf(index) : [restPositionOf(index)], position);
    play.start();
    if (Math.abs(target - position) > 1) return startMove(target, moveSmooth);
    // Native snapping may have put the track there already, short of where the move was headed,
    // so the move never settled. As goTo() does when the track is in place, settle it now.
    programmaticScroll = false;
    onSettle(false);
  }

  /** Rests the track on slide `index`, brought into range, and makes it the current slide. */
  function rest(index: number): void {
    index = loop() ? wrap(index) : clamp(index, 0, maxIndex());
    programmaticScroll = false; // an instant reposition supersedes any goTo() animation
    scrollTo(restPositionOf(index));
    setCurrent(index);
  }

  /** Full path: re-read slides from the DOM, rebuild clones and UI, and rest on slide `index`. */
  function rebuild(index = current): void {
    play.reset(true);
    for (const clone of track.querySelectorAll(`[${CLONE_ATTR}]`)) clone.remove();
    slides = Array.from(track.children) as HTMLElement[];
    slideCount = slides.length;
    slides.forEach((slide, i) => {
      if (!slide.classList.contains(SLIDE_CLASS)) classed.add(slide);
      slide.classList.add(SLIDE_CLASS);
      slide.setAttribute(SLIDE_INDEX_ATTR, String(i));
    });

    container.classList.toggle("aero-slider--vertical", isVertical());
    rtl = computedRtl();
    container.setAttribute("data-aero-alignment", config.alignment);
    container.classList.toggle("aero-slider--draggable", config.draggable);
    container.classList.toggle("aero-slider--free", snapMode() !== "native");

    readSlidesPerView();
    clonesBefore = cloneCount();
    for (let i = 1; i <= clonesBefore; i++) track.prepend(cloneOf(slides[wrap(-i)]!));
    for (let i = 0; i < clonesBefore; i++) track.append(cloneOf(slides[i % slideCount]!));
    // WebKit never starts loading media that arrived from another document with <source> children.
    // The clone can be the media element itself.
    for (const media of track.querySelectorAll<HTMLMediaElement>("video, audio")) {
      if (media.closest(`[${CLONE_ATTR}]`) && media.networkState === media.NETWORK_EMPTY)
        media.load();
    }

    measure();
    dots.build();
    nav.refresh();
    rest(index);
    observe();
    if (ready) play.restart(); // the lap was already reset above
  }

  // ── Public API ───────────────────────────────────────────────────────

  function update(changes?: SliderConfig): void {
    if (destroyed) return;
    configure(config, changes);
    rebuild();
  }

  function refresh(): void {
    if (!destroyed) rebuild();
  }

  function destroy(): void {
    if (destroyed) return;
    emit("destroy", {});
    destroyed = true;
    controller.abort(); // removes every listener; features clean up on this signal too
    resizeObserver.disconnect();
    intersectionObserver?.disconnect();
    clearTimeout(settleTimer);
    cancelAnimationFrame(scrollFrame);
    cancelEase();
    for (const clone of track.querySelectorAll(`[${CLONE_ATTR}]`)) clone.remove();
    for (const slide of slides) {
      slide.removeAttribute(SLIDE_INDEX_ATTR);
      if (classed.has(slide)) slide.classList.remove(SLIDE_CLASS);
      if (slide.getAttribute("class") === "") slide.removeAttribute("class");
    }
    track.style.scrollSnapType = "";
    container.classList.remove(
      "aero-slider--dragging",
      "aero-slider--draggable",
      "aero-slider--free",
      "aero-slider--vertical",
      "aero-slider--ready"
    );
    container.removeAttribute("data-aero-alignment");
    if (container.aeroSlider === api) delete container.aeroSlider;
  }

  const api: SliderInstance = {
    get element() {
      return container;
    },
    get currentIndex() {
      return current;
    },
    get slideCount() {
      return slideCount;
    },
    next,
    prev,
    goTo,
    pause: () => play.hold("api"),
    resume: () => play.release("api"),
    update,
    refresh,
    destroy,
  };

  // ── Init ─────────────────────────────────────────────────────────────

  const core: SliderCore = {
    container,
    track,
    config,
    signal,
    reducedMotion,
    easing: () => easeFrame !== 0,
    current: () => current,
    stopCount: () => stops.length,
    stop: () => stopOf(current),
    slideOfStop: (n) => stops[n]!,
    loop,
    next,
    prev,
    goTo,
    emit,
    isVertical,
    isRtl,
    position: scrollPosition,
    maxScroll: () => maxScroll,
    jumpTo: (position) => scrollTo(position),
    cycle() {
      const width = cycleWidth(); // 0 without a loop, and while nothing is laid out
      // Centred on the real slides, so resting anywhere in it never triggers a teleport.
      return width > 0 ? { start: restPositionOf(0) - slideStride / 2, width } : null;
    },
  };
  // Before the features: they tell their own controls from a nested slider's by this class.
  container.classList.add("aero-slider");
  track.classList.add("aero-slider__track");
  const nav = navigation(core);
  const dots = pagination(core);
  const play = autoplay(core);
  keyboard(core);

  container.removeAttribute("data-aero-defer-visibility");

  track.addEventListener("scroll", onScroll, { passive: true, signal });
  // Reduced motion turned on mid-move: land it now rather than finish the animation.
  reducedMotion.addEventListener(
    "change",
    () => reducedMotion.matches && programmaticScroll && scrollTo(scrollTarget),
    { signal }
  );
  track.addEventListener("scrollend", () => onSettle(), { signal });
  // A wheel along the track takes over from any goTo() animation; one mostly across it is the page
  // scrolling past. Touch and mouse take over in onPointerDown.
  track.addEventListener(
    "wheel",
    ({ deltaX, deltaY, shiftKey }) => {
      // Chromium and Firefox scroll sideways on Shift+wheel but still report it as deltaY.
      const [along, across] = isVertical()
        ? [deltaY, deltaX]
        : shiftKey && !deltaX
          ? [deltaY, 0]
          : [deltaX, deltaY];
      if (Math.abs(along) <= Math.abs(across)) return;
      programmaticScroll = false;
      remeasureAfter = "input";
      fallbackSettle = true;
      cancelEase();
      settleSoon(); // a wheel too small to scroll sends no scroll event to settle after
    },
    { passive: true, signal }
  );
  track.addEventListener("pointerdown", onPointerDown, { signal });
  // Releases land on window wherever the pointer or finger lifts. A settle that waited on them runs
  // once any fling they started comes to rest (and after the click, so a teleport can't steal it).
  const onRelease = (event: Event) => {
    if (event.type.startsWith("touch")) {
      for (const touch of (event as TouchEvent).changedTouches) touches.delete(touch.identifier);
    } else if (event.type === "dragend" || event.type === "pointermove") {
      // A native drag (a link or image) swallows the pointerup: its dragend, or the pointer coming
      // back with no button held, means the press is over.
      if (!pressed.size || (event as PointerEvent).buttons) return;
      pressed.clear();
    } else if (!pressed.delete((event as PointerEvent).pointerId)) return;
    if (pressed.size || touches.size || !settleDeferred) return;
    settleDeferred = false;
    fallbackSettle = true;
    settleSoon();
  };
  // Fingers are counted in the capture phase on window, so content that stops touchstart can't
  // hide one. The release is also heard on the touched element itself: if the page detaches it
  // mid-touch, its touchend no longer reaches window.
  addEventListener(
    "touchstart",
    (event) => {
      const target = event.target as Node;
      if (!track.contains(target)) return;
      for (const touch of (event as TouchEvent).changedTouches) touches.add(touch.identifier);
      remeasureAfter = "input";
      for (const type of ["touchend", "touchcancel"]) {
        target.addEventListener(type, onRelease, { once: true, passive: true, signal });
      }
    },
    { capture: true, passive: true, signal }
  );
  const releases = [
    "pointerup",
    "pointercancel",
    "pointermove",
    "dragend",
    "touchend",
    "touchcancel",
  ];
  for (const type of releases) {
    addEventListener(type, onRelease, { capture: true, passive: true, signal });
  }
  // Keyboard focus in a slide that isn't fully shown brings the slide into view. It waits a frame
  // for any scroll the browser makes to show the focused element, so the two never compete.
  // :focus-visible also matches a text field focused by a click, so track the input itself.
  let pointerFocus = false;
  for (const [type, value] of [
    ["pointerdown", true],
    ["keydown", false],
  ] as const) {
    addEventListener(type, () => (pointerFocus = value), { capture: true, passive: true, signal });
  }
  track.addEventListener(
    "focusin",
    ({ target }) =>
      requestAnimationFrame(() => {
        const index = slides.findIndex((slide) => slide.contains(target as Node));
        // Focus may have moved on during the frame; only the element that still has it counts.
        if (index < 0 || pointerFocus || target !== document.activeElement) return;
        const box = slides[index]!.getBoundingClientRect();
        const view = track.getBoundingClientRect();
        // A slide spans the track across its axis, so all four sides can be checked at once.
        if (
          box.left < view.left - 1 ||
          box.top < view.top - 1 ||
          box.right > view.right + 1 ||
          box.bottom > view.bottom + 1
        ) {
          goTo(index);
        }
      }),
    { signal }
  );
  track.addEventListener("click", onClick, { capture: true, signal });
  track.addEventListener("dragstart", (e) => config.draggable && e.preventDefault(), { signal });

  rebuild();
  container.aeroSlider = api;
  container.classList.add("aero-slider--ready");
  emit("ready", {});
  ready = true;
  play.start();
  return api;
}
