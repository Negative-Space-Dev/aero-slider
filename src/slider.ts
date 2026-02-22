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
  LOOP_CLONE_ATTR,
  WHEEL_IDLE_MS,
} from "./constants.ts";
import { monitorCssVariables } from "./mediaQueryMonitor.ts";
import { createLoopController } from "./loop.ts";
import { createDragController } from "./drag.ts";
import { createNavigation, createPagination, createKeyboard, createAutoplay } from "./features.ts";

export function createSlider(
  container: HTMLElement,
  userConfig: SliderConfig = {}
): SliderInstance {
  const host = container as AeroSliderElement;
  // ── Setup ────────────────────────────────────────────────────────────
  const trackEl = container.querySelector<HTMLElement>(".aero-slider__track");
  if (!trackEl) throw new Error("aero-slider: missing .aero-slider__track");
  const track: HTMLElement = trackEl;

  let slides = Array.from(track.children).filter(
    (el) => !el.hasAttribute(LOOP_CLONE_ATTR)
  ) as HTMLElement[];
  let slideCount = slides.length;
  if (slideCount === 0) throw new Error("aero-slider: no slides found");

  slides.forEach((slide, i) => slide.setAttribute(SLIDE_INDEX_ATTR, String(i)));

  function readCssLayoutConfig(): { slidesPerView: number; gap: number; aspectRatio: string } {
    const s = getComputedStyle(container);
    const slidesPerView =
      parseFloat(s.getPropertyValue("--slides-per-view")?.trim() || "") ||
      LAYOUT_DEFAULTS.slidesPerView;
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
  function emit(event: SliderEvent, data: { index: number; fromIndex?: number }): void {
    listeners.get(event)?.forEach((cb) => cb(data));
  }

  function isVertical(): boolean {
    return config.direction === "ttb";
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

  function getEffectivePerMove(): number {
    return config.perMove > 0 ? config.perMove : 1;
  }

  function normalizeIndex(index: number): number {
    const maxIndex = getMaxIndex();
    if (!isLoopEnabled()) {
      return Math.max(0, Math.min(index, maxIndex));
    }
    return ((Math.trunc(index) % slideCount) + slideCount) % slideCount;
  }

  // ── Direction-aware scroll helpers ───────────────────────────────────

  function getScrollPos(): number {
    if (config.direction === "rtl") return -track.scrollLeft;
    if (config.direction === "ttb") return track.scrollTop;
    return track.scrollLeft;
  }

  function setScrollPos(pos: number): void {
    if (config.direction === "rtl") {
      track.scrollLeft = -pos;
    } else if (config.direction === "ttb") {
      track.scrollTop = pos;
    } else {
      track.scrollLeft = pos;
    }
  }

  function scrollToPos(pos: number, behavior: ScrollBehavior = "auto"): void {
    if (config.direction === "ttb") {
      track.scrollTo({ top: pos, behavior });
    } else if (config.direction === "rtl") {
      track.scrollTo({ left: -pos, behavior });
    } else {
      track.scrollTo({ left: pos, behavior });
    }
  }

  function getViewportSize(): number {
    return isVertical() ? track.clientHeight : track.clientWidth;
  }

  function getTrackScrollSize(): number {
    return isVertical() ? track.scrollHeight : track.scrollWidth;
  }

  function getSlideSize(): number {
    if (state.slideWidthPx > 0) return state.slideWidthPx;
    const first = slides[0];
    if (!first) return 0;
    const rect = first.getBoundingClientRect();
    state.slideWidthPx = (isVertical() ? rect.height : rect.width) + config.gap;
    return state.slideWidthPx;
  }

  function recalcSlideMetrics(): void {
    state.slideWidthPx = 0;
    getSlideSize();
  }

  function applyCssCustomProperties(): void {
    Object.assign(config, readCssLayoutConfig());
  }

  // ── Fractional slidesPerView: alignment helpers ──────────────────────

  function getScrollPosForIndex(index: number): number {
    const w = getSlideSize();
    if (w === 0) return 0;

    if (!isFractionalView()) {
      return index * w;
    }

    const vpSize = getViewportSize();
    const slideVisual = w - config.gap;

    if (state.loopModeActive) {
      return index * w + slideVisual / 2 - vpSize / 2;
    }

    const maxIdx = getMaxIndex();
    if (index <= 0) return 0;
    if (index >= maxIdx) return getTrackScrollSize() - getViewportSize();
    return index * w + slideVisual / 2 - vpSize / 2;
  }

  function getIndexFromScrollPos(scrollPos: number): number {
    const w = getSlideSize();
    if (w === 0) return state.currentIndex;

    const maxIdx = state.loopModeActive ? slideCount - 1 : getMaxIndex();
    const maxScroll = getTrackScrollSize() - getViewportSize();

    if (!isFractionalView()) {
      const raw = Math.round(scrollPos / w);
      return Math.max(0, Math.min(raw, maxIdx));
    }

    if (maxScroll <= 0) return 0;
    if (scrollPos <= 1) return 0;
    if (scrollPos >= maxScroll - 1) return maxIdx;

    const vpSize = getViewportSize();
    const slideVisual = w - config.gap;
    const viewportCenter = scrollPos + vpSize / 2;
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
      for (const child of children) child.style.scrollSnapAlign = "center";
      return;
    }

    for (const child of children) child.style.scrollSnapAlign = "center";
  }

  // ── Direction setup ──────────────────────────────────────────────────

  function applyDirection(): void {
    container.classList.remove("aero-slider--rtl", "aero-slider--vertical");
    container.removeAttribute("dir");

    if (config.direction === "rtl") {
      container.setAttribute("dir", "rtl");
      container.classList.add("aero-slider--rtl");
    } else if (config.direction === "ttb") {
      container.classList.add("aero-slider--vertical");
    }
  }

  // ── Visible / Hidden tracking ────────────────────────────────────────

  const visibleSlides = new Set<number>();

  function computeVisibleSet(): Set<number> {
    const result = new Set<number>();
    const count = Math.ceil(config.slidesPerView);
    for (let i = 0; i < count; i++) {
      let idx = state.currentIndex + i;
      if (state.loopModeActive) {
        idx = ((idx % slideCount) + slideCount) % slideCount;
      } else if (idx >= slideCount) {
        break;
      }
      result.add(idx);
    }
    return result;
  }

  function updateVisibility(): void {
    const newVisible = computeVisibleSet();
    for (const idx of visibleSlides) {
      if (!newVisible.has(idx)) emit("hidden", { index: idx });
    }
    for (const idx of newVisible) {
      if (!visibleSlides.has(idx)) emit("visible", { index: idx });
    }
    visibleSlides.clear();
    for (const idx of newVisible) visibleSlides.add(idx);
  }

  // ── Context (shared across modules) ──────────────────────────────────
  const ctx: SliderContext = {
    container,
    track,
    get slides() {
      return slides;
    },
    get slideCount() {
      return slideCount;
    },
    get config() {
      return config;
    },
    state,
    listeners,
    emit,
    getSlideSize,
    recalcSlideMetrics,
    normalizeIndex,
    getMaxIndex,
    getEffectivePerMove,
    isLoopEnabled,
    isFractionalView,
    isVertical,
    getScrollPos,
    setScrollPos,
    scrollToPos,
    getScrollPosForIndex,
    getIndexFromScrollPos,
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
      : getIndexFromScrollPos(getScrollPos());

    if (idx !== state.currentIndex) {
      state.currentIndex = idx;
      emit("slideChange", { index: state.currentIndex });
      pagination.refresh();
      navigation.refresh();
      updateVisibility();
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
  const LAYOUT_VARS = ["--slides-per-view", "--slide-gap", "--slide-aspect"];

  function setupResizeMonitor(): void {
    teardownResizeMonitor?.();
    teardownResizeMonitor = monitorCssVariables(
      container,
      LAYOUT_VARS,
      () => {
        if (!state.isDestroyed) {
          emit("resize", { index: state.currentIndex });
          update();
          emit("resized", { index: state.currentIndex });
        }
      },
      { debounceMs: RESIZE_DEBOUNCE_MS, maxWaitMs: RESIZE_MAX_WAIT_MS }
    );
  }

  // ── Public API ───────────────────────────────────────────────────────
  function next(): void {
    if (state.isDestroyed) return;
    goTo(normalizeIndex(state.currentIndex + getEffectivePerMove()));
  }

  function prev(): void {
    if (state.isDestroyed) return;
    goTo(normalizeIndex(state.currentIndex - getEffectivePerMove()));
  }

  function goTo(index: number): void {
    if (state.isDestroyed) return;
    const target = normalizeIndex(index);
    const w = getSlideSize();
    if (w === 0) return;

    if (target !== state.currentIndex) {
      state.currentIndex = target;
      emit("slideChange", { index: state.currentIndex });
      pagination.refresh();
      navigation.refresh();
      updateVisibility();
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
          const vpSize = getViewportSize();
          const slideVisual = w - config.gap;
          targetScroll = realStart + target * w + slideVisual / 2 - vpSize / 2;
        }
        scrollToPos(targetScroll, "smooth");
        loop.scheduleTeleport();
        return;
      }

      scrollToPos(getScrollPos() + delta * w, "smooth");
      loop.scheduleTeleport();
      return;
    }

    state.isProgrammaticScroll = true;
    scrollToPos(getScrollPosForIndex(target), "smooth");
  }

  function update(nextConfig?: SliderConfig): void {
    const prevConfig = config;
    config = {
      ...config,
      ...readCssLayoutConfig(),
      ...(nextConfig ?? {}),
    };

    if (prevConfig.direction !== config.direction) {
      applyDirection();
    }

    applyCssCustomProperties();
    recalcSlideMetrics();
    drag.setEnabled(config.draggable);
    keyboard.setEnabled(true);
    autoplay.setHoverPause(config.autoplay);

    if (
      prevConfig.slidesPerView !== config.slidesPerView ||
      prevConfig.loop !== config.loop ||
      prevConfig.maxDots !== config.maxDots ||
      prevConfig.perMove !== config.perMove
    ) {
      pagination.clear();
      pagination.build();
    }

    if (
      prevConfig.autoplay !== config.autoplay ||
      prevConfig.autoplayInterval !== config.autoplayInterval ||
      prevConfig.loop !== config.loop
    ) {
      if (config.autoplay) autoplay.start();
      else autoplay.pause();
    }

    if (prevConfig.loop !== config.loop) {
      if (isLoopEnabled()) loop.setupLoopTrack(state.currentIndex);
      else loop.teardownLoopTrack(state.currentIndex);
    } else if (state.loopModeActive && prevConfig.slidesPerView !== config.slidesPerView) {
      loop.setupLoopTrack(state.currentIndex);
    }

    applySnapAlignment();

    if (!state.loopModeActive) {
      const normalized = normalizeIndex(state.currentIndex);
      state.currentIndex = normalized;
      scrollToPos(getScrollPosForIndex(normalized));
    }

    syncIndex();
    pagination.refresh();
    navigation.refresh();
    updateVisibility();
  }

  function refresh(): void {
    if (state.isDestroyed) return;

    if (state.loopModeActive) {
      loop.teardownLoopTrack(state.currentIndex);
    }

    slides = Array.from(track.children).filter(
      (el) => !el.hasAttribute(LOOP_CLONE_ATTR)
    ) as HTMLElement[];
    slideCount = slides.length;
    if (slideCount === 0) return;

    slides.forEach((slide, i) => {
      slide.setAttribute(SLIDE_INDEX_ATTR, String(i));
      slide.classList.add("aero-slider__slide");
    });

    applyCssCustomProperties();
    recalcSlideMetrics();

    if (isLoopEnabled()) {
      loop.setupLoopTrack(state.currentIndex);
    }

    applySnapAlignment();

    if (!state.loopModeActive) {
      const normalized = normalizeIndex(state.currentIndex);
      state.currentIndex = normalized;
      scrollToPos(getScrollPosForIndex(normalized));
    }

    pagination.clear();
    pagination.build();
    navigation.build();
    syncIndex();
    updateVisibility();
  }

  function add(newSlides: HTMLElement | HTMLElement[], index?: number): void {
    if (state.isDestroyed) return;
    const arr = Array.isArray(newSlides) ? newSlides : [newSlides];

    if (state.loopModeActive) {
      loop.teardownLoopTrack(state.currentIndex);
    }

    const realChildren = Array.from(track.children).filter(
      (el) => !el.hasAttribute(LOOP_CLONE_ATTR)
    );

    if (index !== undefined && index < realChildren.length) {
      const ref = realChildren[index] ?? null;
      for (const slide of arr) track.insertBefore(slide, ref);
    } else {
      for (const slide of arr) track.appendChild(slide);
    }

    refresh();
  }

  function remove(indices: number | number[]): void {
    if (state.isDestroyed) return;
    const arr = Array.isArray(indices) ? indices : [indices];

    if (state.loopModeActive) {
      loop.teardownLoopTrack(state.currentIndex);
    }

    const realChildren = Array.from(track.children).filter(
      (el) => !el.hasAttribute(LOOP_CLONE_ATTR)
    );

    const sorted = [...arr].sort((a, b) => b - a);
    for (const idx of sorted) {
      if (idx >= 0 && idx < realChildren.length) {
        realChildren[idx]!.remove();
      }
    }

    refresh();
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
    emit("destroy", { index: state.currentIndex });
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
    container.removeAttribute("dir");
    container.classList.remove(
      "aero-slider--dragging",
      "aero-slider--rtl",
      "aero-slider--vertical"
    );
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

  applyDirection();
  applyCssCustomProperties();
  recalcSlideMetrics();
  applySnapAlignment();

  track.addEventListener("scroll", onScroll, { passive: true });
  track.addEventListener("wheel", onWheel, { passive: true });

  if (isLoopEnabled()) {
    loop.setupLoopTrack(0);
  } else {
    setScrollPos(0);
  }

  setupResizeMonitor();
  drag.setEnabled(config.draggable);
  keyboard.setEnabled(true);
  autoplay.setHoverPause(config.autoplay);
  navigation.build();
  pagination.build();
  if (config.autoplay) autoplay.start();

  const initialVisible = computeVisibleSet();
  for (const idx of initialVisible) visibleSlides.add(idx);
  for (const idx of visibleSlides) emit("visible", { index: idx });

  const api: SliderInstance = {
    get element() {
      return container;
    },
    next,
    prev,
    goTo,
    destroy,
    update,
    refresh,
    add,
    remove,
    on,
    off,
    get currentIndex() {
      return state.currentIndex;
    },
    get slideCount() {
      return slideCount;
    },
  };

  host.aeroSlider = api;
  emit("ready", { index: state.currentIndex });
  return api;
}
