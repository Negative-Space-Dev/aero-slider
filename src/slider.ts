import type {
  SliderConfig,
  SliderConfigFull,
  SliderInstance,
  SliderEvent,
  SliderEventCallback,
  SliderContext,
  SliderState,
  AeroSliderElement,
} from "./types.ts";
import {
  DEFAULTS,
  LAYOUT_DEFAULTS,
  RESIZE_DEBOUNCE_MS,
  RESIZE_MAX_WAIT_MS,
  SCROLL_END_DELAY,
  SLIDE_INDEX_ATTR,
  WHEEL_IDLE_MS,
} from "./constants.ts";
import { monitorCssVariables } from "./mediaQueryMonitor.ts";
import { createLoopController } from "./loop.ts";
import { createDragController } from "./drag.ts";
import {
  createNavigation,
  createPagination,
  createKeyboard,
  createAutoplay,
} from "./features.ts";

export function createSlider(
  container: HTMLElement,
  userConfig: SliderConfig = {},
): SliderInstance {
  const host = container as AeroSliderElement;
  // ── Setup ────────────────────────────────────────────────────────────
  const trackEl = container.querySelector<HTMLElement>(".aero-slider__track");
  if (!trackEl) throw new Error("aero-slider: missing .aero-slider__track");
  const track: HTMLElement = trackEl;

  const slides = Array.from(track.children) as HTMLElement[];
  const slideCount = slides.length;
  if (slideCount === 0) throw new Error("aero-slider: no slides found");

  slides.forEach((slide, i) => slide.setAttribute(SLIDE_INDEX_ATTR, String(i)));

  function readCssLayoutConfig(): { slidesPerView: number; gap: number; aspectRatio: string } {
    const s = getComputedStyle(container);
    const slidesPerView = parseFloat(s.getPropertyValue("--slides-per-view")?.trim() || "") || LAYOUT_DEFAULTS.slidesPerView;
    const gapStr = s.getPropertyValue("--slide-gap")?.trim() || "0px";
    const gap = parseFloat(gapStr) || LAYOUT_DEFAULTS.gap;
    const aspectRatio = s.getPropertyValue("--slide-aspect")?.trim() || LAYOUT_DEFAULTS.aspectRatio;
    return { slidesPerView, gap, aspectRatio };
  }

  // ── State ────────────────────────────────────────────────────────────
  let config: SliderConfigFull = {
    ...DEFAULTS,
    ...userConfig,
    ...LAYOUT_DEFAULTS,
  };
  const state: SliderState = {
    currentIndex: 0,
    isDragging: false,
    isDestroyed: false,
    loopModeActive: false,
    isProgrammaticScroll: false,
    slideWidthPx: 0,
  };
  const listeners = new Map<SliderEvent, Set<SliderEventCallback>>();

  // ── Timers ───────────────────────────────────────────────────────────
  let scrollRafId: number | null = null;
  let scrollEndTimer: ReturnType<typeof setTimeout> | null = null;
  let teardownResizeMonitor: (() => void) | null = null;

  // ── Core Helpers ─────────────────────────────────────────────────────
  function emit(event: SliderEvent, data: { index: number }): void {
    listeners.get(event)?.forEach((cb) => cb(data));
  }

  function getMaxIndex(): number {
    if (config.slidesPerView % 1 !== 0) return Math.max(0, slideCount - 1);
    return Math.max(0, Math.floor(slideCount - config.slidesPerView));
  }

  function isFractionalView(): boolean {
    return config.slidesPerView % 1 !== 0;
  }

  function isLoopEnabled(): boolean {
    return config.loop && getMaxIndex() > 0;
  }

  function normalizeIndex(index: number): number {
    const maxIndex = getMaxIndex();
    if (!isLoopEnabled()) {
      return Math.max(0, Math.min(index, maxIndex));
    }
    return ((Math.trunc(index) % slideCount) + slideCount) % slideCount;
  }

  function getSlideWidth(): number {
    if (state.slideWidthPx > 0) return state.slideWidthPx;
    const first = slides[0];
    if (!first) return 0;
    state.slideWidthPx = first.getBoundingClientRect().width + config.gap;
    return state.slideWidthPx;
  }

  function recalcSlideMetrics(): void {
    state.slideWidthPx = 0;
    getSlideWidth();
  }

  function applyCssCustomProperties(): void {
    Object.assign(config, readCssLayoutConfig());
  }

  // ── Fractional slidesPerView: alignment helpers ──────────────────────
  // When slidesPerView is fractional (e.g. 1.5), each slide gets its own
  // pagination dot and a smart alignment:
  //   Non-loop mode:
  //     first  → start (left-aligned, next slide peeks from right)
  //     middle → center (previous and next slides peek from both sides)
  //     last   → end (right-aligned, previous slide peeks from left)
  //   Loop mode:
  //     all → center (no visible beginning/end, always peek both sides)

  function getScrollLeftForIndex(index: number): number {
    const w = getSlideWidth();
    if (w === 0) return 0;

    if (!isFractionalView()) {
      return index * w;
    }

    // Fractional view — center the slide in viewport
    const trackWidth = track.clientWidth;
    const slideVisual = w - config.gap;

    if (state.loopModeActive) {
      // In loop mode, always center
      return index * w + slideVisual / 2 - trackWidth / 2;
    }

    // Non-loop: start/center/end based on position
    const maxIdx = getMaxIndex();
    if (index <= 0) return 0;
    if (index >= maxIdx) return track.scrollWidth - track.clientWidth;
    return index * w + slideVisual / 2 - trackWidth / 2;
  }

  function getIndexFromScrollLeft(scrollLeft: number): number {
    const w = getSlideWidth();
    if (w === 0) return state.currentIndex;

    const maxIdx = state.loopModeActive ? slideCount - 1 : getMaxIndex();
    const maxScroll = track.scrollWidth - track.clientWidth;

    if (!isFractionalView()) {
      const raw = Math.round(scrollLeft / w);
      return Math.max(0, Math.min(raw, maxIdx));
    }

    // At scroll boundaries, avoid oscillation from scroll-snap/sub-pixel settling
    if (maxScroll <= 0) return 0;
    if (scrollLeft <= 1) return 0;
    if (scrollLeft >= maxScroll - 1) return maxIdx;

    // Fractional view — determine index from viewport center
    const trackWidth = track.clientWidth;
    const slideVisual = w - config.gap;
    const viewportCenter = scrollLeft + trackWidth / 2;
    const raw = Math.round((viewportCenter - slideVisual / 2) / w);
    return Math.max(0, Math.min(raw, maxIdx));
  }

  function applySnapAlignment(): void {
    const children = Array.from(track.children) as HTMLElement[];

    if (!isFractionalView()) {
      for (const child of children) child.style.scrollSnapAlign = "";
      return;
    }

    if (state.loopModeActive) {
      // Loop mode: all slides centered (no visible start/end)
      for (const child of children) child.style.scrollSnapAlign = "center";
      return;
    }

    // Non-loop fractional: center for every slide.
    // The browser naturally clamps out-of-range snap positions:
    // slide 0's center snap resolves to scrollLeft=0 (left-aligned), and
    // the last slide's center snap resolves to scrollWidth-clientWidth
    // (right-aligned), giving start/center/end visual behaviour without
    // placing two different snap types (center + end) extremely close
    // together — which prevented the last slide from being reachable.
    for (const child of children) child.style.scrollSnapAlign = "center";
  }

  // ── Context (shared across modules) ──────────────────────────────────
  const ctx: SliderContext = {
    container,
    track,
    slides,
    slideCount,
    get config() { return config; },
    state,
    listeners,
    emit,
    getSlideWidth,
    recalcSlideMetrics,
    normalizeIndex,
    getMaxIndex,
    isLoopEnabled,
    isFractionalView,
    getScrollLeftForIndex,
    getIndexFromScrollLeft,
    refreshPagination: () => pagination.refresh(),
    refreshNavState: () => navigation.refresh(),
    applySnapAlignment,
  };

  // ── Feature Controllers ──────────────────────────────────────────────
  const loop = createLoopController(ctx);
  const navigation = createNavigation(ctx, next, prev);
  const pagination = createPagination(ctx, goTo);
  const keyboard = createKeyboard(ctx, next, prev);
  const autoplay = createAutoplay(ctx, next);
  const drag = createDragController(ctx, loop, goTo, autoplay.pause, autoplay.start);

  // ── Scroll Handling ──────────────────────────────────────────────────
  function syncIndex(): void {
    if (state.isDragging || state.isProgrammaticScroll) return;

    const idx = state.loopModeActive
      ? loop.getLoopIndexFromScroll()
      : getIndexFromScrollLeft(track.scrollLeft);

    if (idx !== state.currentIndex) {
      state.currentIndex = idx;
      emit("slideChange", { index: state.currentIndex });
      pagination.refresh();
      navigation.refresh();
    }
  }

  function onScrollSettle(): void {
    scrollEndTimer = null;
    state.isProgrammaticScroll = false;
    if (wheelTimer === null) {
      track.style.scrollSnapType = "";
    }
    syncIndex();
  }

  function onScroll(): void {
    if (state.loopModeActive) {
      loop.scheduleTeleport();
    }
    if (scrollEndTimer !== null) clearTimeout(scrollEndTimer);
    scrollEndTimer = setTimeout(onScrollSettle, SCROLL_END_DELAY);
    if (scrollRafId !== null) return;
    scrollRafId = requestAnimationFrame(() => {
      scrollRafId = null;
      syncIndex();
    });
  }

  // ── Native Wheel/Trackpad Scroll ─────────────────────────────────────
  // Mandatory snap fights continuous wheel input — the browser snaps to a
  // slide mid-gesture, freezing the scroll. Disable snap for the duration
  // of active wheel input and re-enable once the user has clearly stopped.
  // 300ms covers even slow mouse wheel detent gaps (~200ms).
  let wheelTimer: ReturnType<typeof setTimeout> | null = null;

  function onWheel(): void {
    if (state.isDragging) return;

    track.style.scrollSnapType = "none";

    if (wheelTimer !== null) clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      wheelTimer = null;
      track.style.scrollSnapType = "";
    }, WHEEL_IDLE_MS);
  }

  // ── Media Query / Resize Monitor ───────────────────────────────────────
  // Listen to window.resize (only way to catch media query shifts). When
  // --slides-per-view, --slide-gap, or --slide-aspect change, re-run update().
  const LAYOUT_VARS = ["--slides-per-view", "--slide-gap", "--slide-aspect"];

  function setupResizeMonitor(): void {
    teardownResizeMonitor?.();
    teardownResizeMonitor = monitorCssVariables(
      container,
      LAYOUT_VARS,
      () => {
        if (!state.isDestroyed) update();
      },
      { debounceMs: RESIZE_DEBOUNCE_MS, maxWaitMs: RESIZE_MAX_WAIT_MS },
    );
  }

  // ── Public API ───────────────────────────────────────────────────────
  function next(): void {
    if (state.isDestroyed) return;
    goTo(normalizeIndex(state.currentIndex + 1));
  }

  function prev(): void {
    if (state.isDestroyed) return;
    goTo(normalizeIndex(state.currentIndex - 1));
  }

  function goTo(index: number): void {
    if (state.isDestroyed) return;
    const target = normalizeIndex(index);
    const w = getSlideWidth();
    if (w === 0) return;

    if (target !== state.currentIndex) {
      state.currentIndex = target;
      emit("slideChange", { index: state.currentIndex });
      pagination.refresh();
      navigation.refresh();
    }

    if (state.loopModeActive) {
      loop.cancelTeleport();
      state.isProgrammaticScroll = true;

      const actualCurrent = loop.getLoopIndexFromScroll();
      const forward = (target - actualCurrent + slideCount) % slideCount;
      const backward = forward - slideCount;
      const delta = Math.abs(backward) < forward ? backward : forward;

      if (delta === 0) {
        const realStart = loop.getLoopRealStart();
        let targetScroll = realStart + target * w;
        if (isFractionalView()) {
          const trackWidth = track.clientWidth;
          const slideVisual = w - config.gap;
          targetScroll = realStart + target * w + slideVisual / 2 - trackWidth / 2;
        }
        track.scrollTo({ left: targetScroll, behavior: "smooth" });
        loop.scheduleTeleport();
        return;
      }

      track.scrollTo({ left: track.scrollLeft + delta * w, behavior: "smooth" });
      loop.scheduleTeleport();
      return;
    }

    state.isProgrammaticScroll = true;
    track.scrollTo({ left: getScrollLeftForIndex(target), behavior: "smooth" });
  }

  function update(nextConfig?: SliderConfig): void {
    const prev = config;
    config = {
      ...config,
      ...readCssLayoutConfig(),
      ...(nextConfig ?? {}),
    };

    applyCssCustomProperties();
    recalcSlideMetrics();
    drag.setEnabled(config.draggable);
    keyboard.setEnabled(true);
    autoplay.setHoverPause(config.autoplay);

    if (prev.slidesPerView !== config.slidesPerView || prev.loop !== config.loop || prev.maxDots !== config.maxDots) {
      pagination.clear();
      pagination.build();
    }

    if (
      prev.autoplay !== config.autoplay ||
      prev.autoplayInterval !== config.autoplayInterval ||
      prev.loop !== config.loop
    ) {
      if (config.autoplay) autoplay.start();
      else autoplay.pause();
    }

    if (prev.loop !== config.loop) {
      if (isLoopEnabled()) loop.setupLoopTrack(state.currentIndex);
      else loop.teardownLoopTrack(state.currentIndex);
    } else if (state.loopModeActive && prev.slidesPerView !== config.slidesPerView) {
      loop.setupLoopTrack(state.currentIndex);
    }

    applySnapAlignment();

    if (!state.loopModeActive) {
      const normalized = normalizeIndex(state.currentIndex);
      state.currentIndex = normalized;
      track.scrollTo({ left: getScrollLeftForIndex(normalized), behavior: "auto" });
    }

    syncIndex();
    pagination.refresh();
    navigation.refresh();
  }

  function on(event: SliderEvent, callback: SliderEventCallback): void {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(callback);
  }

  function off(event: SliderEvent, callback: SliderEventCallback): void {
    listeners.get(event)?.delete(callback);
  }

  function destroy(): void {
    if (state.isDestroyed) return;
    state.isDestroyed = true;

    autoplay.pause();
    if (state.loopModeActive) loop.teardownLoopTrack(state.currentIndex);
    loop.cancelTeleport();
    state.isProgrammaticScroll = false;

    teardownResizeMonitor?.();
    teardownResizeMonitor = null;

    track.removeEventListener("scroll", onScroll);
    track.removeEventListener("wheel", onWheel);
    if (wheelTimer !== null) clearTimeout(wheelTimer);
    if (scrollEndTimer !== null) clearTimeout(scrollEndTimer);
    drag.setEnabled(false);
    keyboard.setEnabled(false);
    autoplay.setHoverPause(false);

    if (scrollRafId !== null) cancelAnimationFrame(scrollRafId);
    navigation.clear();
    pagination.clear();

    container.removeAttribute("aria-roledescription");
    container.classList.remove("aero-slider--dragging");
    if (host.aeroSlider === api) {
      delete host.aeroSlider;
    }

    listeners.clear();
  }

  // ── Initialize ───────────────────────────────────────────────────────
  container.classList.add("aero-slider");
  container.setAttribute("aria-roledescription", "carousel");
  track.classList.add("aero-slider__track");
  for (const slide of slides) slide.classList.add("aero-slider__slide");

  applyCssCustomProperties();
  recalcSlideMetrics();
  applySnapAlignment();

  track.addEventListener("scroll", onScroll, { passive: true });
  track.addEventListener("wheel", onWheel, { passive: true });

  if (isLoopEnabled()) {
    loop.setupLoopTrack(0);
  } else {
    track.scrollLeft = 0;
  }

  setupResizeMonitor();
  drag.setEnabled(config.draggable);
  keyboard.setEnabled(true);
  autoplay.setHoverPause(config.autoplay);
  navigation.build();
  pagination.build();
  if (config.autoplay) autoplay.start();

  const api: SliderInstance = {
    get element() { return container; },
    next,
    prev,
    goTo,
    destroy,
    update,
    on,
    off,
    get currentIndex() { return state.currentIndex; },
    get slideCount() { return slideCount; },
  };

  host.aeroSlider = api;
  return api;
}
