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
  const { container, track, state } = ctx;
  let listenersActive = false;

  function getDragCoord(e: PointerEvent): number {
    if (ctx.isVertical()) return e.clientY;
    return e.clientX;
  }

  function getDragSign(): number {
    return ctx.config.direction === "rtl" ? -1 : 1;
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    if (e.pointerType === "touch") return;

    if (ctx.config.noDrag && (e.target as Element).closest(ctx.config.noDrag)) return;

    track.setPointerCapture(e.pointerId);
    state.isDragging = true;

    const sign = getDragSign();
    const startCoord = getDragCoord(e);
    const startScroll = ctx.getScrollPos();
    let pendingScroll = startScroll;
    let moveRafId: number | null = null;
    let velocity = 0;
    let lastCoord = startCoord;
    let lastTime = performance.now();

    function flushDragScroll(): void {
      moveRafId = null;
      ctx.setScrollPos(pendingScroll);
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
      const coord = getDragCoord(ev);
      pendingScroll = startScroll + (startCoord - coord) * sign;
      if (moveRafId === null) {
        moveRafId = requestAnimationFrame(flushDragScroll);
      }

      const now = performance.now();
      const dt = now - lastTime;
      if (dt > 0) {
        if (dt < 100) {
          const instantVelocity = ((lastCoord - coord) * sign) / dt;
          velocity =
            VELOCITY_SMOOTHING * instantVelocity +
            (1 - VELOCITY_SMOOTHING) * velocity;
        } else {
          velocity *= 0.5;
        }
        lastCoord = coord;
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
        ctx.setScrollPos(pendingScroll);
      }

      const timeSinceLastMove = performance.now() - lastTime;
      if (timeSinceLastMove > 50) {
        velocity *= Math.max(0, 1 - timeSinceLastMove / 200);
      }

      const w = ctx.getSlideSize();
      track.style.scrollBehavior = "";

      if (w > 0) {
        if (state.loopModeActive) {
          loop.teleportIfNeeded();

          const realStart = loop.getLoopRealStart();
          const scrollPos = ctx.getScrollPos();
          const vpSize = ctx.isVertical() ? track.clientHeight : track.clientWidth;
          let rawIdx: number;
          let targetScroll: number;

          if (ctx.isFractionalView()) {
            const slideVisual = w - ctx.config.gap;
            const projectedCenter =
              scrollPos + velocity * MOMENTUM_FACTOR + vpSize / 2;
            rawIdx = Math.round((projectedCenter - realStart - slideVisual / 2) / w);
            targetScroll = realStart + rawIdx * w + slideVisual / 2 - vpSize / 2;
          } else {
            const offset = scrollPos - realStart;
            const projected = offset + velocity * MOMENTUM_FACTOR;
            rawIdx = Math.round(projected / w);
            targetScroll = realStart + rawIdx * w;
          }

          state.isProgrammaticScroll = true;
          ctx.scrollToPos(targetScroll, "smooth");
          loop.scheduleTeleport();

          const normalizedTarget = ctx.normalizeIndex(rawIdx);
          if (normalizedTarget !== state.currentIndex) {
            state.currentIndex = normalizedTarget;
            ctx.emit("slideChange", { index: state.currentIndex });
            ctx.refreshPagination();
            ctx.refreshNavState();
          }
        } else {
          const projected = ctx.getScrollPos() + velocity * MOMENTUM_FACTOR;
          const target = ctx.getIndexFromScrollPos(projected);
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
