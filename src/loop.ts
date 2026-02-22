import type { SliderContext } from "./types.ts";
import { LOOP_CLONE_ATTR, SLIDE_INDEX_ATTR } from "./constants.ts";

const TELEPORT_DELAY_MS = 50;
const CLONE_BUFFER = 2;
const MIN_CLONE_SETS = 3;

export interface LoopController {
  getLoopRealStart(): number;
  getLoopRealEnd(): number;
  getLoopIndexFromScroll(): number;
  instantScrollTo(pos: number): void;
  teleportIfNeeded(): void;
  scheduleTeleport(): void;
  setupLoopTrack(anchorIndex: number): void;
  teardownLoopTrack(anchorIndex: number): void;
  cancelTeleport(): void;
}

export function createLoopController(ctx: SliderContext): LoopController {
  const { track, state } = ctx;
  let teleportTimer: ReturnType<typeof setTimeout> | null = null;
  let cloneSets = MIN_CLONE_SETS;

  function calcCloneSets(): number {
    const needed = Math.ceil(ctx.config.slidesPerView) + CLONE_BUFFER;
    return Math.max(MIN_CLONE_SETS, Math.ceil(needed / ctx.slideCount));
  }

  function getLoopRealStart(): number {
    return cloneSets * ctx.slideCount * state.slideWidthPx;
  }

  function getLoopRealEnd(): number {
    return (cloneSets + 1) * ctx.slideCount * state.slideWidthPx;
  }

  function instantScrollTo(pos: number): void {
    track.style.scrollBehavior = "auto";
    ctx.setScrollPos(pos);
    requestAnimationFrame(() => {
      track.style.scrollBehavior = "";
    });
  }

  function teleportIfNeeded(): void {
    if (!state.loopModeActive) return;
    const w = state.slideWidthPx;
    if (w === 0) return;

    const sectionWidth = ctx.slideCount * w;
    const realStart = getLoopRealStart();
    const realEnd = getLoopRealEnd();
    let pos = ctx.getScrollPos();

    // Tolerance (px) to prevent sub-pixel oscillation near boundaries.
    // Without this, scroll positions like 5470.5 vs realStart 5472.0 can
    // cause rapid teleport flickering due to browser sub-pixel rounding.
    const TELEPORT_TOLERANCE = 2;

    if (pos < realStart - TELEPORT_TOLERANCE || pos >= realEnd + TELEPORT_TOLERANCE) {
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

    const vpSize = ctx.isVertical() ? track.clientHeight : track.clientWidth;

    if (ctx.isFractionalView()) {
      const slideVisual = w - ctx.config.gap;
      const viewportCenter = ctx.getScrollPos() + vpSize / 2;
      const realStart = getLoopRealStart();
      const raw = Math.round((viewportCenter - realStart - slideVisual / 2) / w);
      return ((raw % ctx.slideCount) + ctx.slideCount) % ctx.slideCount;
    }

    const offset = ctx.getScrollPos() - getLoopRealStart();
    const raw = Math.round(offset / w);
    return ((raw % ctx.slideCount) + ctx.slideCount) % ctx.slideCount;
  }

  function setupLoopTrack(anchorIndex: number): void {
    if (!ctx.isLoopEnabled()) {
      if (state.loopModeActive) teardownLoopTrack(anchorIndex);
      return;
    }

    cloneSets = calcCloneSets();
    track.querySelectorAll(`[${LOOP_CLONE_ATTR}]`).forEach((c) => c.remove());

    const { slides, slideCount } = ctx;

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
    const realStart = cloneSets * ctx.slideCount * w;
    let scrollPos = realStart + idx * w;

    if (ctx.isFractionalView()) {
      const vpSize = ctx.isVertical() ? track.clientHeight : track.clientWidth;
      const slideVisual = w - ctx.config.gap;
      scrollPos = realStart + idx * w + slideVisual / 2 - vpSize / 2;
    }

    instantScrollTo(scrollPos);
  }

  function teardownLoopTrack(anchorIndex: number): void {
    cancelTeleport();
    track.querySelectorAll(`[${LOOP_CLONE_ATTR}]`).forEach((c) => c.remove());
    state.loopModeActive = false;
    ctx.recalcSlideMetrics();
    state.currentIndex = Math.max(0, Math.min(anchorIndex, ctx.getMaxIndex()));
    instantScrollTo(ctx.getScrollPosForIndex(state.currentIndex));
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
