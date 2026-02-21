import type { SliderContext } from "./types.ts";

// ── Navigation Arrows ──────────────────────────────────────────────────
// User provides elements with .aero-slider__nav--prev and .aero-slider__nav--next.
// If they exist, we wire click handlers and manage disabled state.
export interface NavigationController {
  build(): void;
  clear(): void;
  refresh(): void;
}

export function createNavigation(
  ctx: SliderContext,
  next: () => void,
  prev: () => void,
): NavigationController {
  let prevBtn: HTMLButtonElement | null = null;
  let nextBtn: HTMLButtonElement | null = null;

  function clear(): void {
    if (prevBtn) {
      prevBtn.removeEventListener("click", prev);
      prevBtn = null;
    }
    if (nextBtn) {
      nextBtn.removeEventListener("click", next);
      nextBtn = null;
    }
  }

  function build(): void {
    clear();
    prevBtn = ctx.container.querySelector<HTMLButtonElement>(".aero-slider__nav--prev");
    nextBtn = ctx.container.querySelector<HTMLButtonElement>(".aero-slider__nav--next");
    if (prevBtn) prevBtn.addEventListener("click", prev);
    if (nextBtn) nextBtn.addEventListener("click", next);
    refresh();
  }

  function refresh(): void {
    const maxIndex = ctx.getMaxIndex();
    const hasMultiplePages = maxIndex > 0;
    if (prevBtn) {
      prevBtn.disabled =
        !hasMultiplePages || (!ctx.isLoopEnabled() && ctx.state.currentIndex === 0);
    }
    if (nextBtn) {
      nextBtn.disabled =
        !hasMultiplePages || (!ctx.isLoopEnabled() && ctx.state.currentIndex >= maxIndex);
    }
  }

  return { build, clear, refresh };
}

// ── Pagination Dots ────────────────────────────────────────────────────
// User provides a container with class aero-slider__pagination and one dot
// with class aero-slider__dot as a template. We clone the dot for each slide
// and only manage count + active state.
export interface PaginationController {
  build(): void;
  clear(): void;
  refresh(): void;
}

export function createPagination(
  ctx: SliderContext,
  goTo: (index: number) => void,
): PaginationController {
  let container: HTMLElement | null = null;
  let templateDot: HTMLElement | null = null;
  let dots: HTMLElement[] = [];

  function onPaginationClick(e: Event): void {
    const dot = (e.target as HTMLElement).closest(".aero-slider__dot");
    if (!dot || !container) return;
    const all = container.querySelectorAll<HTMLElement>(".aero-slider__dot");
    const i = Array.from(all).indexOf(dot);
    if (i >= 0) goTo(i);
  }

  function clear(): void {
    if (container) {
      container.removeEventListener("click", onPaginationClick);
      const all = container.querySelectorAll<HTMLElement>(".aero-slider__dot");
      for (let i = 1; i < all.length; i++) {
        all[i].remove();
      }
      container = null;
    }
    templateDot = null;
    dots = [];
  }

  function getPageCount(): number {
    return ctx.isLoopEnabled() ? ctx.slideCount : ctx.getMaxIndex() + 1;
  }

  function build(): void {
    container = ctx.container.querySelector<HTMLElement>(".aero-slider__pagination");
    if (!container) return;

    templateDot = container.querySelector<HTMLElement>(".aero-slider__dot");
    if (!templateDot) return;

    container.setAttribute("role", "tablist");
    container.addEventListener("click", onPaginationClick);

    const pageCount = getPageCount();
    const existing = container.querySelectorAll<HTMLElement>(".aero-slider__dot");

    if (existing.length > pageCount) {
      for (let i = pageCount; i < existing.length; i++) {
        existing[i].remove();
      }
    } else if (existing.length < pageCount) {
      for (let i = existing.length; i < pageCount; i++) {
        const clone = templateDot.cloneNode(true) as HTMLElement;
        container.appendChild(clone);
      }
    }

    dots = Array.from(container.querySelectorAll<HTMLElement>(".aero-slider__dot"));
    dots.forEach((dot, i) => {
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
    });
    refresh();
  }

  function refresh(): void {
    dots.forEach((dot, i) => {
      const active = i === ctx.state.currentIndex;
      dot.classList.toggle("aero-slider__dot--active", active);
      dot.setAttribute("aria-selected", String(active));
    });
  }

  return { build, clear, refresh };
}

// ── Keyboard Navigation ────────────────────────────────────────────────
export interface KeyboardController {
  setEnabled(enabled: boolean): void;
}

export function createKeyboard(
  ctx: SliderContext,
  next: () => void,
  prev: () => void,
): KeyboardController {
  let active = false;

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    }
  }

  function setEnabled(enabled: boolean): void {
    if (enabled === active) return;
    if (enabled) {
      ctx.container.setAttribute("tabindex", "0");
      ctx.container.addEventListener("keydown", onKeydown);
      active = true;
    } else {
      ctx.container.removeAttribute("tabindex");
      ctx.container.removeEventListener("keydown", onKeydown);
      active = false;
    }
  }

  return { setEnabled };
}

// ── Autoplay ───────────────────────────────────────────────────────────
export interface AutoplayController {
  start(): void;
  pause(): void;
  setHoverPause(enabled: boolean): void;
}

export function createAutoplay(
  ctx: SliderContext,
  next: () => void,
): AutoplayController {
  let timer: ReturnType<typeof setInterval> | null = null;
  let hoverListenersActive = false;

  function start(): void {
    if (!ctx.config.autoplay) return;
    pause();
    timer = setInterval(() => {
      if (!ctx.state.loopModeActive && ctx.state.currentIndex >= ctx.getMaxIndex()) {
        pause();
        return;
      }
      next();
    }, ctx.config.autoplayInterval);
    ctx.emit("autoplayStart", { index: ctx.state.currentIndex });
  }

  function pause(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
      ctx.emit("autoplayStop", { index: ctx.state.currentIndex });
    }
  }

  function onMouseEnter(): void {
    pause();
  }

  function onMouseLeave(): void {
    if (ctx.config.autoplay) start();
  }

  function setHoverPause(enabled: boolean): void {
    if (enabled === hoverListenersActive) return;
    if (enabled) {
      ctx.container.addEventListener("mouseenter", onMouseEnter);
      ctx.container.addEventListener("mouseleave", onMouseLeave);
      hoverListenersActive = true;
    } else {
      ctx.container.removeEventListener("mouseenter", onMouseEnter);
      ctx.container.removeEventListener("mouseleave", onMouseLeave);
      hoverListenersActive = false;
    }
  }

  return { start, pause, setHoverPause };
}

