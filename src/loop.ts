import type { SliderContext } from "./types.ts";
import { LOOP_CLONE_ATTR, SLIDE_INDEX_ATTR } from "./constants.ts";
import { measureSnapScrollPos } from "./snapMetrics.ts";

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
    state.isProgrammaticScroll = true;
    state.suppressSettleEmit = true;
    track.style.scrollBehavior = "auto";
    track.style.scrollSnapType = "none";
    ctx.setScrollPos(pos);
    // Double RAF ensures browser has painted the position before re-enabling
    // scroll-snap. Single RAF only guarantees layout, not paint.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        track.style.scrollBehavior = "";
        track.style.scrollSnapType = "";
        state.isProgrammaticScroll = false;
      });
    });
  }

  function teleportIfNeeded(): void {
    if (!state.loopModeActive) return;
    if (state.isProgrammaticScroll || state.isDragging) return;
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
    return ctx.getIndexFromScrollPos(ctx.getScrollPos());
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
    ctx.applySnapAlignment();

    // Defer scroll until after browser layout completes.
    requestAnimationFrame(() => {
      ctx.recalcSlideMetrics();

      const idx = ctx.normalizeIndex(anchorIndex);
      state.currentIndex = idx;

      if (state.slideWidthPx === 0) return;

      // Anchor to the real (non-clone) slide rather than the snap target
      // nearest the current scroll position. Mid-setup the scroll position is
      // unreliable: Chrome re-snaps to the tracked snap target after clones
      // are prepended, but Safari leaves the scroller at its old offset, so a
      // nearest-match lookup resolves to a leading clone whose snap position
      // is negative (clamped to 0) — leaving the active slide uncentered on
      // initial load.
      const realSlide = ctx.slides[idx];
      const pos = realSlide
        ? measureSnapScrollPos(realSlide, track, ctx.config.alignment, ctx.isVertical())
        : ctx.getScrollPosForLoopIndex(idx);

      state.isProgrammaticScroll = true;
      state.suppressSettleEmit = true;
      track.style.scrollBehavior = "auto";
      track.style.scrollSnapType = "none";
      ctx.setScrollPos(pos);

      // Re-enable scroll-snap after browser paints the position.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          track.style.scrollBehavior = "";
          track.style.scrollSnapType = "";
          state.isProgrammaticScroll = false;
        });
      });
    });
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
