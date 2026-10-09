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

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

const DEFAULTS: Required<SliderConfig> = {
  loop: false,
  autoplay: false,
  autoplayInterval: 5000,
  autoplaySpeed: 40,
  draggable: true,
  alignment: "center",
  maxDots: 0,
  noDrag: "",
  perMove: 1,
  direction: "ltr",
  snap: "native",
  scrollDuration: 0,
  scrollEasing: easeOutCubic,
};

const DRAG_THRESHOLD_PX = 5;
const FLICK_VELOCITY = 0.3; // px per ms
const FLICK_PROJECTION_MS = 250;
const SETTLE_FALLBACK_MS = 150; // for browsers without the scrollend event
const WHEEL_SETTLE_MS = 200; // Firefox can skip scrollend after wheel scrolling

/** What the UI features (nav, dots, keyboard, autoplay) need from the core. */
export interface SliderCore {
  container: HTMLElement;
  track: HTMLElement;
  config: Required<SliderConfig>;
  signal: AbortSignal;
  reducedMotion: MediaQueryList;
  /** A scrollDuration animation is in flight. */
  easing(): boolean;
  current(): number;
  maxIndex(): number;
  pageCount(): number;
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
  const track = requireTrack(container);

  const config: Required<SliderConfig> = { ...DEFAULTS, ...userConfig };
  const controller = new AbortController();
  const { signal } = controller;

  let slides: HTMLElement[] = [];
  let slideCount = 0;
  let current = 0;
  let destroyed = false;

  // Layout metrics, refreshed by measure()
  let slidesPerView = 1;
  let clonesBefore = 0; // loop clones prepended ahead of the real slides
  let slideStride = 0; // distance between neighbouring snap positions; 0 until laid out
  let firstSnapPosition = 0; // snap position of track.children[0]
  let maxScroll = 0;
  let paddingStart = 0; // track padding doubles as scroll-padding (see slider.css)
  let paddingEnd = 0;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  // Scroll state
  let programmaticScroll = false; // a goTo() animation is in flight
  let scrollTarget = 0; // where that animation is headed
  let dragging = false;
  let suppressNextClick = false;
  let scrollFrame = 0;
  let settleTimer = 0;
  let easeFrame = 0; // a scrollDuration animation is in flight
  let fallbackSettle = false; // a wheel or touch moved the track and scrollend may never come
  const pressed = new Set<number>(); // mouse and pen pointers down on the track
  // Fingers on the track, from touch events: a pan turns the pointer stream into pointercancel
  // while the finger is still down, so pointer events can't say when it lifts.
  const touches = new Set<number>();
  let settleDeferred = false; // a settle arrived while a pointer or finger was still down

  const isVertical = () => config.direction === "ttb";
  const isRtl = () => config.direction === "rtl";
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
  const wrap = (index: number) => ((index % slideCount) + slideCount) % slideCount;

  function maxIndex(): number {
    const pagesByStart = config.alignment === "left" && Number.isInteger(slidesPerView);
    return Math.max(0, pagesByStart ? slideCount - slidesPerView : slideCount - 1);
  }
  const continuous = () => config.autoplay === "continuous";
  // Continuous autoplay loops by nature and moves the track by hand, so snapping stays off.
  const loop = () => (continuous() ? slideCount > 1 : config.loop && maxIndex() > 0);
  const snapMode = () => (continuous() ? "none" : config.snap);
  const pageCount = () => (loop() ? slideCount : maxIndex() + 1);
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
    if (isVertical()) return track.scrollTop;
    return isRtl() ? -track.scrollLeft : track.scrollLeft;
  }

  function nativeScrollTo(position: number, behavior: ScrollBehavior): void {
    if (isVertical()) track.scrollTo({ top: position, behavior });
    else track.scrollTo({ left: isRtl() ? -position : position, behavior });
  }

  function cancelEase(): void {
    if (!easeFrame) return;
    cancelAnimationFrame(easeFrame);
    easeFrame = 0;
    track.style.scrollSnapType = "";
  }

  /** Smooth scrolls honour prefers-reduced-motion, and use scrollDuration's easing when set. */
  function scrollTo(position: number, smooth = false): void {
    cancelEase();
    if (!smooth || reducedMotion.matches) return nativeScrollTo(position, "instant");
    if (config.scrollDuration <= 0) return nativeScrollTo(position, "smooth");

    const from = scrollPosition();
    const distance = position - from;
    const started = performance.now();
    track.style.scrollSnapType = "none"; // mandatory snapping would pull every frame to a slide
    const step = (now: number) => {
      // Frame timestamps can predate `started`, so clamp before easing.
      const t = Math.min(1, Math.max(0, (now - started) / config.scrollDuration));
      nativeScrollTo(from + distance * config.scrollEasing(t), "instant");
      easeFrame = t < 1 ? requestAnimationFrame(step) : 0;
      if (!easeFrame) track.style.scrollSnapType = "";
    };
    easeFrame = requestAnimationFrame(step);
  }

  /** Scroll position at which `el` rests on its snap point, honouring alignment and scroll-padding. */
  function snapPositionOf(el: Element): number {
    const rect = el.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();
    const [axisStart, axisSize, elStart, elEnd] = isVertical()
      ? [trackRect.top + track.clientTop, track.clientHeight, rect.top, rect.bottom]
      : isRtl() // mirror x so "start" is the right edge
        ? [
            -(trackRect.left + track.clientLeft + track.clientWidth),
            track.clientWidth,
            -rect.right,
            -rect.left,
          ]
        : [trackRect.left + track.clientLeft, track.clientWidth, rect.left, rect.right];
    const snapportStart = axisStart + paddingStart;
    const snapportEnd = axisStart + axisSize - paddingEnd;
    const delta =
      config.alignment === "left"
        ? elStart - snapportStart
        : config.alignment === "right"
          ? elEnd - snapportEnd
          : (elStart + elEnd - snapportStart - snapportEnd) / 2;
    return scrollPosition() + delta;
  }

  function readSlidesPerView(): void {
    const value = getComputedStyle(container).getPropertyValue("--slides-per-view");
    slidesPerView = parseFloat(value) || 1;
  }

  function measure(): void {
    const style = getComputedStyle(track);
    if (isVertical()) {
      paddingStart = parseFloat(style.paddingTop);
      paddingEnd = parseFloat(style.paddingBottom);
    } else {
      paddingStart = parseFloat(isRtl() ? style.paddingRight : style.paddingLeft);
      paddingEnd = parseFloat(isRtl() ? style.paddingLeft : style.paddingRight);
    }
    const [first, second] = track.children;
    const axisSize = isVertical() ? track.clientHeight : track.clientWidth;
    firstSnapPosition = first ? snapPositionOf(first) : 0;
    slideStride = second ? snapPositionOf(second) - firstSnapPosition : axisSize; // 0 under display: none
    maxScroll = isVertical()
      ? track.scrollHeight - track.clientHeight
      : track.scrollWidth - track.clientWidth;
  }

  // ── Indexing ─────────────────────────────────────────────────────────
  // "DOM index" counts track children including clones; "index" is the
  // logical slide number the public API speaks in.

  const domIndexAt = (position: number) => Math.round((position - firstSnapPosition) / slideStride);
  const isRealDomIndex = (domIndex: number) =>
    domIndex >= clonesBefore && domIndex < clonesBefore + slideCount;
  const indexOfDom = (domIndex: number) =>
    loop() ? wrap(domIndex - clonesBefore) : clamp(domIndex, 0, maxIndex());

  function indexAt(position: number): number {
    if (!loop()) {
      if (position <= 1) return 0;
      if (position >= maxScroll - 1) return maxIndex();
    }
    return indexOfDom(domIndexAt(position));
  }

  /** Where the real copy of slide `index` rests. */
  function restPositionOf(index: number): number {
    const position = snapPositionOf(track.children[clonesBefore + index]!);
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
    const clone = track.children[domIndex];
    const real = track.children[clonesBefore + wrap(domIndex - clonesBefore)];
    return clone && real ? snapPositionOf(real) - snapPositionOf(clone) : 0;
  }

  function teleportToRealSlides(): void {
    if (!loop()) return;
    const domIndex = domIndexAt(scrollPosition());
    if (!isRealDomIndex(domIndex)) scrollTo(scrollPosition() + shiftToRealCopy(domIndex));
  }

  /** One lap of real slides on a loop: the distance from a slide to its next copy. */
  function cycleWidth(): number {
    const first = track.children[clonesBefore];
    const twin = track.children[clonesBefore + slideCount];
    return first && twin ? snapPositionOf(twin) - snapPositionOf(first) : 0;
  }

  /**
   * Starts a programmatic move. The browser clamps scrolling to the runway, so the target is
   * clamped too; otherwise onSettle() would wait forever for a spot the track can't reach.
   */
  function startMove(target: number, smooth = true): void {
    programmaticScroll = true;
    scrollTarget = clamp(target, 0, maxScroll);
    scrollTo(scrollTarget, smooth);
  }

  function cloneOf(slide: HTMLElement): HTMLElement {
    const clone = slide.cloneNode(true) as HTMLElement;
    clone.removeAttribute(SLIDE_INDEX_ATTR);
    clone.setAttribute(CLONE_ATTR, "");
    clone.setAttribute("aria-hidden", "true");
    for (const el of [clone, ...clone.querySelectorAll("[id]")]) el.removeAttribute("id");
    // The slide itself can be the link (a card), so it leaves the tab order too.
    const focusable = "a, button, input, select, textarea, [tabindex]";
    for (const el of [clone, ...clone.querySelectorAll<HTMLElement>(focusable)]) {
      if (el.matches(focusable)) el.tabIndex = -1;
    }
    return clone;
  }

  // ── Navigation ───────────────────────────────────────────────────────

  function goTo(index: number, options: GoToOptions = {}): void {
    if (destroyed || !slideCount) return;
    // Continuous autoplay hands its lap back to the scroll offset before we measure from it.
    play.interrupt();
    const logical = loop() ? wrap(Math.trunc(index)) : clamp(Math.trunc(index), 0, maxIndex());
    setCurrent(logical);
    if (!slideStride) return; // no layout yet (display: none); relayout() lands here once shown
    let target: number;
    if (loop()) {
      teleportToRealSlides();
      const fromDom = domIndexAt(scrollPosition());
      const forward = wrap(logical - indexOfDom(fromDom));
      const steps = forward > slideCount / 2 ? forward - slideCount : forward;
      target = snapPositionOf(track.children[fromDom + steps]!);
    } else {
      target = restPositionOf(logical);
    }
    if (Math.abs(target - scrollPosition()) < 1) {
      // Already there, but a move started a moment ago may still be headed elsewhere: stop it.
      if (programmaticScroll) scrollTo(target);
      programmaticScroll = false;
      return onSettle();
    }
    startMove(target, !options.instant);
  }

  const step = () => Math.max(1, Math.trunc(config.perMove));
  /** Steps from the slide that's showing: a continuous lap hands back first, so sync to it. */
  function stepBy(delta: number): void {
    if (play.interrupt()) setCurrent(indexAt(scrollPosition()));
    goTo(current + delta);
  }
  const next = () => stepBy(step());
  const prev = () => stepBy(-step());

  // ── Scroll tracking ──────────────────────────────────────────────────

  function onScroll(): void {
    play.scrolled();
    if (!programmaticScroll && !scrollFrame) {
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        // A goTo() since this frame was queued (a drag's release) has already set the index.
        if (!programmaticScroll) setCurrent(indexAt(scrollPosition()));
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

  function onSettle(): void {
    if (dragging) return;
    clearTimeout(settleTimer);
    fallbackSettle = false;
    // A pointer still down owns the track: a finger may still be scrolling it, and a teleport now
    // would swap the pressed card for its copy, so a click would miss the link. Settle on release.
    if (pressed.size || touches.size) {
      settleDeferred = true;
      return;
    }
    // A scrollend from an instant scroll issued just before goTo() lands mid-animation; wait for ours.
    if (programmaticScroll && Math.abs(scrollPosition() - scrollTarget) > 1) return;
    const userScroll = !programmaticScroll;
    programmaticScroll = false;
    track.style.scrollSnapType = "";
    if (userScroll && snapMode() === "settle" && settleNear(scrollPosition())) return;
    teleportToRealSlides();
    const position = scrollPosition();
    const landed = indexAt(position);
    // A clamped edge can park several indices at one spot; keep the requested one there.
    const moved = loop() || Math.abs(position - restPositionOf(current)) > 1;
    if (landed !== current && moved) setCurrent(landed);
    play.settled();
  }

  /**
   * Eases onto track.children[domIndex]. On a loop, a clone whose snap point lies off the runway
   * (fractional slides per view put the end clones there) is swapped for its real twin: the track
   * first jumps by the same distance, which looks identical, so nothing visibly flies across.
   */
  function settleOnto(domIndex: number): void {
    let target = snapPositionOf(track.children[domIndex]!);
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
    if (Math.abs(snapPositionOf(track.children[domIndex]!) - scrollPosition()) <= 1) return false;
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
    // Fingers are counted from touch events (see touchstart below).
    if (event.pointerType !== "touch") pressed.add(event.pointerId);
    // A wheel settle that was still pending waits for the pointer or finger to lift.
    if (fallbackSettle) settleDeferred = true;
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
    let pending = startScroll;
    let lastCoord = startCoord;
    let lastTime = event.timeStamp;
    let velocity = 0; // px per ms along the logical axis
    let frame = 0;

    function onMove(move: PointerEvent): void {
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
      pending = startScroll + (startCoord - coord) * direction;
      if (loop()) {
        const domIndex = domIndexAt(pending);
        if (!isRealDomIndex(domIndex)) {
          const shift = shiftToRealCopy(domIndex);
          pending += shift;
          startScroll += shift;
        }
      }
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          scrollTo(pending);
        });
      }
    }

    function onUp(up: PointerEvent): void {
      gesture.abort();
      if (!dragging) return;
      dragging = false;
      container.classList.remove("aero-slider--dragging");
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
        scrollTo(pending);
      }
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
          if (Math.abs(rest - scrollPosition()) > 1) startMove(rest);
          else onSettle();
        }
        emit("dragEnd", { index: current, fromIndex });
        play.release("drag");
        return;
      }

      // Like native paging: a flick always moves at least one slide its way.
      let domTarget = domIndexAt(scrollPosition() + velocity * FLICK_PROJECTION_MS);
      if (Math.abs(velocity) > FLICK_VELOCITY && domTarget === domIndexAt(scrollPosition())) {
        domTarget += Math.sign(velocity);
      }
      goTo(indexOfDom(domTarget));
      emit("dragEnd", { index: current, fromIndex });
      play.release("drag");
    }

    const options = { signal: gesture.signal };
    track.addEventListener("pointermove", onMove, options);
    track.addEventListener("pointerup", onUp, options);
    track.addEventListener("pointercancel", onUp, options);
    signal.addEventListener("abort", () => gesture.abort(), options);
  }

  function onClick(event: MouseEvent): void {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    event.preventDefault();
    event.stopPropagation();
  }

  // ── Observers ────────────────────────────────────────────────────────

  let skipInitialResize = false;
  const resizeObserver = new ResizeObserver(() => {
    if (skipInitialResize) {
      skipInitialResize = false;
      return;
    }
    if (destroyed) return;
    emit("resize", {});
    relayout();
    emit("resized", {});
  });

  let intersectionObserver: IntersectionObserver | undefined;
  const intersecting = new Map<Element, boolean>();
  let visibleIndices = new Set<number>();

  function onIntersection(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) intersecting.set(entry.target, entry.isIntersecting);
    const children = Array.from(track.children);
    const nowVisible = new Set<number>();
    for (const [el, isIn] of intersecting) {
      if (isIn) nowVisible.add(indexOfDom(children.indexOf(el)));
    }
    for (const index of visibleIndices) if (!nowVisible.has(index)) emit("hidden", { index });
    for (const index of nowVisible) if (!visibleIndices.has(index)) emit("visible", { index });
    visibleIndices = nowVisible;
  }

  function observe(): void {
    resizeObserver.disconnect();
    skipInitialResize = true;
    resizeObserver.observe(track);
    if (track.firstElementChild) resizeObserver.observe(track.firstElementChild);

    intersectionObserver?.disconnect();
    intersecting.clear();
    intersectionObserver = new IntersectionObserver(onIntersection, {
      root: track,
      rootMargin: isVertical() ? "-1px 0px" : "0px -1px", // ignore sub-pixel bleed from neighbours
    });
    for (const child of track.children) intersectionObserver.observe(child);
  }

  // ── Layout ───────────────────────────────────────────────────────────

  /** Cheap path for size changes: re-measure and keep the current slide in place. */
  function relayout(): void {
    const previousPages = pageCount();
    play.reset(); // continuous autoplay's transforms would skew every measurement
    readSlidesPerView();
    if (cloneCount() !== clonesBefore) return rebuild();
    measure();
    if (pageCount() !== previousPages) dots.build();
    current = loop() ? wrap(current) : clamp(current, 0, maxIndex());
    programmaticScroll = false; // an instant reposition supersedes any goTo() animation
    scrollTo(restPositionOf(current));
    nav.refresh();
    play.start();
  }

  /** Full path: re-read slides from the DOM, rebuild clones and UI. */
  function rebuild(): void {
    play.reset();
    for (const clone of track.querySelectorAll(`[${CLONE_ATTR}]`)) clone.remove();
    slides = Array.from(track.children) as HTMLElement[];
    slideCount = slides.length;
    if (!slideCount) return;
    slides.forEach((slide, i) => {
      slide.classList.add("aero-slider__slide");
      slide.setAttribute(SLIDE_INDEX_ATTR, String(i));
    });

    container.classList.toggle("aero-slider--vertical", isVertical());
    if (isRtl()) container.setAttribute("dir", "rtl");
    else container.removeAttribute("dir");
    container.setAttribute("data-aero-alignment", config.alignment);
    container.classList.toggle("aero-slider--draggable", config.draggable);
    container.classList.toggle("aero-slider--free", snapMode() !== "native");

    readSlidesPerView();
    clonesBefore = cloneCount();
    for (let i = 1; i <= clonesBefore; i++) track.prepend(cloneOf(slides[wrap(-i)]!));
    for (let i = 0; i < clonesBefore; i++) track.append(cloneOf(slides[i % slideCount]!));

    measure();
    current = loop() ? wrap(current) : clamp(current, 0, maxIndex());
    programmaticScroll = false; // an instant reposition supersedes any goTo() animation
    scrollTo(restPositionOf(current));
    dots.build();
    nav.refresh();
    observe();
    play.stop(); // restarts interval autoplay's countdown; the lap was already reset above
    play.start();
  }

  // ── Public API ───────────────────────────────────────────────────────

  function update(changes?: SliderConfig): void {
    if (destroyed) return;
    Object.assign(config, changes);
    rebuild();
  }

  function refresh(): void {
    if (!destroyed) rebuild();
  }

  function add(newSlides: HTMLElement | HTMLElement[], index?: number): void {
    if (destroyed) return;
    const before = index === undefined ? null : (slides[index] ?? null);
    for (const slide of ([] as HTMLElement[]).concat(newSlides)) track.insertBefore(slide, before);
    rebuild();
  }

  function remove(indices: number | number[]): void {
    if (destroyed) return;
    for (const index of ([] as number[]).concat(indices)) slides[index]?.remove();
    rebuild();
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
    track.style.scrollSnapType = "";
    container.classList.remove(
      "aero-slider--dragging",
      "aero-slider--draggable",
      "aero-slider--free",
      "aero-slider--vertical",
      "aero-slider--ready"
    );
    for (const attr of ["aria-roledescription", "dir", "data-aero-alignment"]) {
      container.removeAttribute(attr);
    }
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
    add,
    remove,
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
    maxIndex,
    pageCount,
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
      if (!loop() || !slideStride) return null;
      const first = track.children[clonesBefore];
      const twin = track.children[clonesBefore + slideCount];
      if (!first || !twin) return null;
      const home = snapPositionOf(first);
      const width = snapPositionOf(twin) - home;
      // Centred on the real slides, so resting anywhere in it never triggers a teleport.
      return width > 0 ? { start: home - slideStride / 2, width } : null;
    },
  };
  const nav = navigation(core);
  const dots = pagination(core);
  const play = autoplay(core);
  keyboard(core);

  container.removeAttribute("data-aero-defer-visibility");
  container.classList.add("aero-slider");
  container.setAttribute("aria-roledescription", "carousel");
  track.classList.add("aero-slider__track");

  track.addEventListener("scroll", onScroll, { passive: true, signal });
  // Reduced motion turned on mid-move: land it now rather than finish the animation.
  reducedMotion.addEventListener(
    "change",
    () => reducedMotion.matches && programmaticScroll && scrollTo(scrollTarget),
    { signal }
  );
  track.addEventListener("scrollend", onSettle, { signal });
  // The wheel takes over from any goTo() animation; touch and mouse do so in onPointerDown.
  track.addEventListener(
    "wheel",
    () => {
      programmaticScroll = false;
      fallbackSettle = true;
      cancelEase();
    },
    { passive: true, signal }
  );
  track.addEventListener("pointerdown", onPointerDown, { signal });
  track.addEventListener(
    "touchstart",
    (event) => {
      for (const touch of event.changedTouches) touches.add(touch.identifier);
    },
    { passive: true, signal }
  );
  // Releases land on window wherever the pointer or finger lifts. A settle that waited on them runs
  // once any fling they started comes to rest (and after the click, so a teleport can't steal it).
  const onRelease = (event: Event) => {
    if (event.type.startsWith("touch")) {
      for (const touch of (event as TouchEvent).changedTouches) touches.delete(touch.identifier);
    } else if (!pressed.delete((event as PointerEvent).pointerId)) return;
    if (pressed.size || touches.size || !settleDeferred) return;
    settleDeferred = false;
    fallbackSettle = true;
    clearTimeout(settleTimer);
    settleTimer = window.setTimeout(onSettle, WHEEL_SETTLE_MS);
  };
  for (const type of ["pointerup", "pointercancel", "touchend", "touchcancel"]) {
    addEventListener(type, onRelease, { capture: true, passive: true, signal });
  }
  track.addEventListener("click", onClick, { capture: true, signal });
  track.addEventListener("dragstart", (e) => config.draggable && e.preventDefault(), { signal });

  rebuild();
  container.aeroSlider = api;
  container.classList.add("aero-slider--ready");
  emit("ready", {});
  return api;
}
