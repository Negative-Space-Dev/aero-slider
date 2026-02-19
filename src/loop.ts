import type { SliderContext } from "./types.ts";
import { LOOP_CLONE_ATTR, SLIDE_INDEX_ATTR } from "./constants.ts";

const TELEPORT_DELAY_MS = 50;
const CLONE_BUFFER = 2;
const MIN_CLONE_SETS = 3;

export interface LoopController {
  getLoopRealStart(): number;
  getLoopRealEnd(): number;
  getLoopIndexFromScroll(): number;
  instantScrollTo(left: number): void;
  teleportIfNeeded(): void;
  scheduleTeleport(): void;
  setupLoopTrack(anchorIndex: number): void;
  teardownLoopTrack(anchorIndex: number): void;
  cancelTeleport(): void;
}

export function createLoopController(ctx: SliderContext): LoopController {
  const { track, slides, slideCount, state } = ctx;
  let teleportTimer: ReturnType<typeof setTimeout> | null = null;
  let cloneSets = MIN_CLONE_SETS;

  function calcCloneSets(): number {
    const needed = Math.ceil(ctx.config.slidesPerView) + CLONE_BUFFER;
    return Math.max(MIN_CLONE_SETS, Math.ceil(needed / slideCount));
  }

  function getLoopRealStart(): number {
    return cloneSets * slideCount * state.slideWidthPx;
  }

  function getLoopRealEnd(): number {
    return (cloneSets + 1) * slideCount * state.slideWidthPx;
  }

  function instantScrollTo(left: number): void {
    track.style.scrollBehavior = "auto";
    track.scrollLeft = left;
    requestAnimationFrame(() => {
      track.style.scrollBehavior = "";
    });
  }

  function teleportIfNeeded(): void {
    if (!state.loopModeActive) return;
    const w = state.slideWidthPx;
    if (w === 0) return;

    const sectionWidth = slideCount * w;
    const realStart = getLoopRealStart();
    const realEnd = getLoopRealEnd();
    let pos = track.scrollLeft;

    if (pos < realStart || pos >= realEnd) {
      while (pos < realStart) pos += sectionWidth;
      while (pos >= realEnd) pos -= sectionWidth;
      instantScrollTo(pos);
    }
  }

  function scheduleTeleport(): void {
    if (teleportTimer !== null) clearTimeout(teleportTimer);
    teleportTimer = setTimeout(() => {
      teleportTimer = null;
      teleportIfNeeded();
    }, TELEPORT_DELAY_MS);
  }

  function cancelTeleport(): void {
    if (teleportTimer !== null) {
      clearTimeout(teleportTimer);
      teleportTimer = null;
    }
  }

  function getLoopIndexFromScroll(): number {
    const w = state.slideWidthPx;
    if (w === 0) return state.currentIndex;

    if (ctx.isFractionalView()) {
      const trackWidth = track.clientWidth;
      const slideVisual = w - ctx.config.gap;
      const viewportCenter = track.scrollLeft + trackWidth / 2;
      const realStart = getLoopRealStart();
      const raw = Math.round((viewportCenter - realStart - slideVisual / 2) / w);
      return ((raw % slideCount) + slideCount) % slideCount;
    }

    const offset = track.scrollLeft - getLoopRealStart();
    const raw = Math.round(offset / w);
    return ((raw % slideCount) + slideCount) % slideCount;
  }

  function setupLoopTrack(anchorIndex: number): void {
    if (!ctx.isLoopEnabled()) {
      if (state.loopModeActive) teardownLoopTrack(anchorIndex);
      return;
    }

    cloneSets = calcCloneSets();
    track.querySelectorAll(`[${LOOP_CLONE_ATTR}]`).forEach((c) => c.remove());

    for (let s = 0; s < cloneSets; s++) {
      for (let i = slideCount - 1; i >= 0; i--) {
        const clone = slides[i]!.cloneNode(true) as HTMLElement;
        clone.setAttribute(LOOP_CLONE_ATTR, "");
        clone.removeAttribute(SLIDE_INDEX_ATTR);
        track.prepend(clone);
      }
    }

    for (let s = 0; s < cloneSets; s++) {
      for (let i = 0; i < slideCount; i++) {
        const clone = slides[i]!.cloneNode(true) as HTMLElement;
        clone.setAttribute(LOOP_CLONE_ATTR, "");
        clone.removeAttribute(SLIDE_INDEX_ATTR);
        track.append(clone);
      }
    }

    state.loopModeActive = true;
    ctx.recalcSlideMetrics();
    ctx.applySnapAlignment();

    const idx = ctx.normalizeIndex(anchorIndex);
    state.currentIndex = idx;

    const w = state.slideWidthPx;
    const realStart = cloneSets * slideCount * w;
    let scrollPos = realStart + idx * w;

    if (ctx.isFractionalView()) {
      const trackWidth = track.clientWidth;
      const slideVisual = w - ctx.config.gap;
      scrollPos = realStart + idx * w + slideVisual / 2 - trackWidth / 2;
    }

    instantScrollTo(scrollPos);
  }

  function teardownLoopTrack(anchorIndex: number): void {
    cancelTeleport();
    track.querySelectorAll(`[${LOOP_CLONE_ATTR}]`).forEach((c) => c.remove());
    state.loopModeActive = false;
    ctx.recalcSlideMetrics();
    state.currentIndex = Math.max(0, Math.min(anchorIndex, ctx.getMaxIndex()));
    instantScrollTo(ctx.getScrollLeftForIndex(state.currentIndex));
  }

  return {
    getLoopRealStart,
    getLoopRealEnd,
    getLoopIndexFromScroll,
    instantScrollTo,
    teleportIfNeeded,
    scheduleTeleport,
    setupLoopTrack,
    teardownLoopTrack,
    cancelTeleport,
  };
}
