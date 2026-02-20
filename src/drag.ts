import type { SliderContext } from "./types.ts";
import type { LoopController } from "./loop.ts";
import { VELOCITY_SMOOTHING, MOMENTUM_FACTOR } from "./constants.ts";

export interface DragController {
  setEnabled(enabled: boolean): void;
  isActive(): boolean;
}

export function createDragController(
  ctx: SliderContext,
  loop: LoopController,
  goTo: (index: number) => void,
  pauseAutoplay: () => void,
  startAutoplay: () => void,
): DragController {
  const { container, track, slideCount, state } = ctx;
  let listenersActive = false;

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    /* On touch devices, let native scroll handle horizontal panning; avoid
     * intercepting touch with custom drag which feels broken on mobile Safari. */
    if (e.pointerType === "touch") return;

    track.setPointerCapture(e.pointerId);
    state.isDragging = true;

    const startX = e.clientX;
    const startScroll = track.scrollLeft;
    let pendingScrollLeft = startScroll;
    let moveRafId: number | null = null;
    let velocity = 0;
    let lastX = startX;
    let lastTime = performance.now();

    function flushDragScroll(): void {
      moveRafId = null;
      track.scrollLeft = pendingScrollLeft;
    }

    track.style.scrollBehavior = "auto";
    track.style.scrollSnapType = "none";
    container.classList.add("aero-slider--dragging");
    const startIndex = state.currentIndex;
    ctx.emit("dragStart", { index: startIndex });
    pauseAutoplay();

    function onPointerMove(ev: PointerEvent): void {
      if (!state.isDragging) return;
      ev.preventDefault();
      pendingScrollLeft = startScroll + (startX - ev.clientX);
      if (moveRafId === null) {
        moveRafId = requestAnimationFrame(flushDragScroll);
      }

      const now = performance.now();
      const dt = now - lastTime;
      if (dt > 0) {
        if (dt < 100) {
          const instantVelocity = (lastX - ev.clientX) / dt;
          velocity =
            VELOCITY_SMOOTHING * instantVelocity +
            (1 - VELOCITY_SMOOTHING) * velocity;
        } else {
          velocity *= 0.5;
        }
        lastX = ev.clientX;
        lastTime = now;
      }
    }

    function onPointerUp(): void {
      if (!state.isDragging) return;
      state.isDragging = false;
      container.classList.remove("aero-slider--dragging");

      if (moveRafId !== null) {
        cancelAnimationFrame(moveRafId);
        moveRafId = null;
        track.scrollLeft = pendingScrollLeft;
      }

      const timeSinceLastMove = performance.now() - lastTime;
      if (timeSinceLastMove > 50) {
        velocity *= Math.max(0, 1 - timeSinceLastMove / 200);
      }

      const w = ctx.getSlideWidth();
      track.style.scrollBehavior = "";

      if (w > 0) {
        if (state.loopModeActive) {
          loop.teleportIfNeeded();

          const realStart = loop.getLoopRealStart();
          let rawIdx: number;
          let targetScroll: number;

          if (ctx.isFractionalView()) {
            // Fractional view: use viewport center for index calculation
            const trackWidth = track.clientWidth;
            const slideVisual = w - ctx.config.gap;
            const projectedCenter =
              track.scrollLeft + velocity * MOMENTUM_FACTOR + trackWidth / 2;
            rawIdx = Math.round((projectedCenter - realStart - slideVisual / 2) / w);
            targetScroll = realStart + rawIdx * w + slideVisual / 2 - trackWidth / 2;
          } else {
            const offset = track.scrollLeft - realStart;
            const projected = offset + velocity * MOMENTUM_FACTOR;
            rawIdx = Math.round(projected / w);
            targetScroll = realStart + rawIdx * w;
          }

          state.isProgrammaticScroll = true;
          track.scrollTo({ left: targetScroll, behavior: "smooth" });
          loop.scheduleTeleport();

          const normalizedTarget = ctx.normalizeIndex(rawIdx);
          if (normalizedTarget !== state.currentIndex) {
            state.currentIndex = normalizedTarget;
            ctx.emit("slideChange", { index: state.currentIndex });
            ctx.refreshPagination();
            ctx.refreshNavState();
          }
        } else {
          const projected = track.scrollLeft + velocity * MOMENTUM_FACTOR;
          const target = ctx.getIndexFromScrollLeft(projected);
          goTo(target);
        }
      }

      ctx.emit("dragEnd", { index: state.currentIndex, fromIndex: startIndex });
      track.removeEventListener("pointermove", onPointerMove);
      track.removeEventListener("pointerup", onPointerUp);
      track.removeEventListener("pointercancel", onPointerUp);

      if (ctx.config.autoplay) startAutoplay();
    }

    track.addEventListener("pointermove", onPointerMove);
    track.addEventListener("pointerup", onPointerUp);
    track.addEventListener("pointercancel", onPointerUp);
  }

  function onDragStart(e: Event): void {
    e.preventDefault();
  }

  function setEnabled(enabled: boolean): void {
    if (enabled === listenersActive) return;
    if (enabled) {
      track.addEventListener("pointerdown", onPointerDown);
      track.addEventListener("dragstart", onDragStart);
      listenersActive = true;
    } else {
      track.removeEventListener("pointerdown", onPointerDown);
      track.removeEventListener("dragstart", onDragStart);
      listenersActive = false;
    }
  }

  return {
    setEnabled,
    isActive: () => listenersActive,
  };
}
