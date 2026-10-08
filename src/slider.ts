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

const DEFAULTS: Required<SliderConfig> = {
  loop: false,
  autoplay: false,
  autoplayInterval: 5000,
  draggable: true,
  alignment: "center",
  maxDots: 0,
  noDrag: "",
  perMove: 1,
  direction: "ltr",
};

const DRAG_THRESHOLD_PX = 5;
const FLICK_VELOCITY = 0.3; // px per ms
const FLICK_PROJECTION_MS = 250;
const SETTLE_FALLBACK_MS = 150; // for browsers without the scrollend event

/** What the UI features (nav, dots, keyboard, autoplay) need from the core. */
export interface SliderCore {
  container: HTMLElement;
  track: HTMLElement;
  config: Required<SliderConfig>;
  signal: AbortSignal;
  reducedMotion: MediaQueryList;
  current(): number;
  maxIndex(): number;
  pageCount(): number;
  loop(): boolean;
  next(): void;
  prev(): void;
  goTo(index: number, options?: GoToOptions): void;
  emit<E extends SliderEvent>(event: E, data: SliderEventData<E>): void;
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

  const isVertical = () => config.direction === "ttb";
  const isRtl = () => config.direction === "rtl";
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
  const wrap = (index: number) => ((index % slideCount) + slideCount) % slideCount;

  function maxIndex(): number {
    const pagesByStart = config.alignment === "left" && Number.isInteger(slidesPerView);
    return Math.max(0, pagesByStart ? slideCount - slidesPerView : slideCount - 1);
  }
  const loop = () => config.loop && maxIndex() > 0;
  const pageCount = () => (loop() ? slideCount : maxIndex() + 1);
  const cloneCount = () => (loop() ? Math.max(slideCount, Math.ceil(slidesPerView) + 2) : 0);

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

  /** Smooth scrolls honour prefers-reduced-motion. */
  function scrollTo(position: number, smooth = false): void {
    const behavior: ScrollBehavior = smooth && !reducedMotion.matches ? "smooth" : "instant";
    if (isVertical()) track.scrollTo({ top: position, behavior });
    else track.scrollTo({ left: isRtl() ? -position : position, behavior });
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
    programmaticScroll = true;
    scrollTarget = target;
    scrollTo(target, !options.instant);
  }

  const step = () => Math.max(1, Math.trunc(config.perMove));
  const next = () => goTo(current + step());
  const prev = () => goTo(current - step());

  // ── Scroll tracking ──────────────────────────────────────────────────

  function onScroll(): void {
    play.scrolled();
    if (!programmaticScroll && !scrollFrame) {
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        setCurrent(indexAt(scrollPosition()));
      });
    }
    if (!("onscrollend" in track)) {
      clearTimeout(settleTimer);
      settleTimer = window.setTimeout(onSettle, SETTLE_FALLBACK_MS);
    }
  }

  function onSettle(): void {
    if (dragging) return;
    // A scrollend from an instant scroll issued just before goTo() lands mid-animation; wait for ours.
    if (programmaticScroll && Math.abs(scrollPosition() - scrollTarget) > 1) return;
    programmaticScroll = false;
    track.style.scrollSnapType = "";
    teleportToRealSlides();
    const position = scrollPosition();
    const landed = indexAt(position);
    // A clamped edge can park several indices at one spot; keep the requested one there.
    const moved = loop() || Math.abs(position - restPositionOf(current)) > 1;
    if (landed !== current && moved) setCurrent(landed);
    play.settled();
  }

  // ── Mouse / pen drag ─────────────────────────────────────────────────
  // Touch scrolls natively. For other pointers we move the scroller by hand
  // with snapping off, then release into a smooth scroll the way a fling would.

  function onPointerDown(event: PointerEvent): void {
    suppressNextClick = false;
    programmaticScroll = false; // a press takes over from any goTo() animation
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
    readSlidesPerView();
    if (cloneCount() !== clonesBefore) return rebuild();
    measure();
    if (pageCount() !== previousPages) dots.build();
    current = loop() ? wrap(current) : clamp(current, 0, maxIndex());
    programmaticScroll = false; // an instant reposition supersedes any goTo() animation
    scrollTo(restPositionOf(current));
    nav.refresh();
  }

  /** Full path: re-read slides from the DOM, rebuild clones and UI. */
  function rebuild(): void {
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
    play.stop();
    if (config.autoplay) play.start();
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
    for (const clone of track.querySelectorAll(`[${CLONE_ATTR}]`)) clone.remove();
    track.style.scrollSnapType = "";
    container.classList.remove(
      "aero-slider--dragging",
      "aero-slider--draggable",
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
    current: () => current,
    maxIndex,
    pageCount,
    loop,
    next,
    prev,
    goTo,
    emit,
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
  track.addEventListener("scrollend", onSettle, { signal });
  track.addEventListener("wheel", () => (programmaticScroll = false), { passive: true, signal });
  track.addEventListener("pointerdown", onPointerDown, { signal });
  track.addEventListener("click", onClick, { capture: true, signal });
  track.addEventListener("dragstart", (e) => config.draggable && e.preventDefault(), { signal });

  rebuild();
  container.aeroSlider = api;
  container.classList.add("aero-slider--ready");
  emit("ready", {});
  return api;
}
