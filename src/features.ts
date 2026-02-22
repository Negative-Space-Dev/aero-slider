import type { SliderContext } from "./types.ts";

// ── Navigation Arrows ──────────────────────────────────────────────────
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
  let prevHandler: () => void = prev;
  let nextHandler: () => void = next;

  function clear(): void {
    if (prevBtn) {
      prevBtn.removeEventListener("click", prevHandler);
      prevBtn = null;
    }
    if (nextBtn) {
      nextBtn.removeEventListener("click", nextHandler);
      nextBtn = null;
    }
  }

  function build(): void {
    clear();
    prevBtn = ctx.container.querySelector<HTMLButtonElement>(".aero-slider__nav--prev");
    nextBtn = ctx.container.querySelector<HTMLButtonElement>(".aero-slider__nav--next");
    // In RTL, DOM order flips: prev ends up on the right (with ← icon), next on the left (with → icon).
    // Swap handlers so arrows match direction of travel (→ = go right/prev, ← = go left/next).
    const isRtl = ctx.config.direction === "rtl";
    prevHandler = isRtl ? next : prev;
    nextHandler = isRtl ? prev : next;
    if (prevBtn) prevBtn.addEventListener("click", prevHandler);
    if (nextBtn) nextBtn.addEventListener("click", nextHandler);
    refresh();
  }

  function refresh(): void {
    const maxIndex = ctx.getMaxIndex();
    const hasMultiplePages = maxIndex > 0;
    const isRtl = ctx.config.direction === "rtl";
    // In RTL we swapped handlers: prevBtn→next, nextBtn→prev. Swap disabled logic to match.
    const prevDisabled = !hasMultiplePages || (!ctx.isLoopEnabled() && ctx.state.currentIndex === 0);
    const nextDisabled = !hasMultiplePages || (!ctx.isLoopEnabled() && ctx.state.currentIndex >= maxIndex);
    if (prevBtn) prevBtn.disabled = isRtl ? nextDisabled : prevDisabled;
    if (nextBtn) nextBtn.disabled = isRtl ? prevDisabled : nextDisabled;
  }

  return { build, clear, refresh };
}

// ── Pagination Dots ────────────────────────────────────────────────────
// User provides a container with class aero-slider__pagination and one dot
// with class aero-slider__dot as a template. We clone the dot for each slide
// and only manage count + active state. When maxDots is set and exceeded,
// shows a windowed view with edge indicators.
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
  let dotsTrack: HTMLElement | null = null;
  let templateDot: HTMLElement | null = null;
  let dots: HTMLElement[] = [];
  let isWindowed = false;
  let dotSize = 10; // Will be measured from template
  let dotGap = 8;

  function onPaginationClick(e: Event): void {
    const dot = (e.target as HTMLElement).closest(".aero-slider__dot");
    if (!dot || !container) return;
    const index = dot.getAttribute("data-slide-index");
    if (index !== null) goTo(Number(index));
  }

  function clear(): void {
    if (container) {
      container.removeEventListener("click", onPaginationClick);
      // Remove track if we created it
      dotsTrack?.remove();
      dotsTrack = null;
      // Restore template visibility
      if (templateDot) templateDot.style.display = "";
      // Remove all dots except the template
      const all = container.querySelectorAll<HTMLElement>(".aero-slider__dot");
      for (let i = 1; i < all.length; i++) {
        all[i].remove();
      }
      // Remove any old labels
      container.querySelectorAll(".aero-slider__pagination-label").forEach(el => el.remove());
      container = null;
    }
    templateDot = null;
    dots = [];
    isWindowed = false;
  }

  function getPageCount(): number {
    return ctx.isLoopEnabled() ? ctx.slideCount : ctx.getMaxIndex() + 1;
  }

  function build(): void {
    container = ctx.container.querySelector<HTMLElement>(".aero-slider__pagination");
    if (!container) return;

    templateDot = container.querySelector<HTMLElement>(".aero-slider__dot");
    if (!templateDot) return;

    // Ensure template is visible and unscaled for measuring
    const wasHidden = templateDot.style.display === "none";
    if (wasHidden) templateDot.style.display = "";
    templateDot.style.transform = "";
    templateDot.style.opacity = "";
    
    // Force reflow before measuring
    void templateDot.offsetWidth;
    
    // Measure dot size using computed style (more reliable for hidden elements)
    const computedStyle = getComputedStyle(templateDot);
    dotSize = parseFloat(computedStyle.width) || 10;
    const containerStyle = getComputedStyle(container);
    dotGap = parseInt(containerStyle.gap) || 8;

    container.setAttribute("role", "tablist");
    container.addEventListener("click", onPaginationClick);

    const pageCount = getPageCount();
    const maxDots = ctx.config.maxDots;
    isWindowed = maxDots > 0 && pageCount > maxDots;
    
    // Clear existing structure
    dotsTrack?.remove();
    const existing = container.querySelectorAll<HTMLElement>(".aero-slider__dot");
    for (let i = 1; i < existing.length; i++) {
      existing[i].remove();
    }
    container.querySelectorAll(".aero-slider__pagination-label").forEach(el => el.remove());

    if (isWindowed) {
      // iOS-style: create ALL dots in a sliding track
      container.classList.add("aero-slider__pagination--windowed");
      
      // Set container width to show only maxDots
      const visibleWidth = maxDots * dotSize + (maxDots - 1) * dotGap;
      container.style.setProperty("--pagination-width", `${visibleWidth}px`);
      
      // Create inner track for all dots
      dotsTrack = document.createElement("div");
      dotsTrack.className = "aero-slider__pagination-track";
      
      // Hide original template, create clones in track
      templateDot.style.display = "none";
      
      // Create all dots as clones
      for (let i = 0; i < pageCount; i++) {
        const clone = templateDot.cloneNode(true) as HTMLElement;
        clone.style.display = "";
        dotsTrack.appendChild(clone);
      }
      
      container.appendChild(dotsTrack);
    } else {
      // Standard pagination: one dot per page
      container.classList.remove("aero-slider__pagination--windowed");
      container.style.removeProperty("--pagination-width");
      templateDot.style.display = "";
      for (let i = 1; i < pageCount; i++) {
        const clone = templateDot.cloneNode(true) as HTMLElement;
        container.appendChild(clone);
      }
    }

    // Query dots from track if windowed, otherwise from container
    const dotsParent = isWindowed && dotsTrack ? dotsTrack : container;
    dots = Array.from(dotsParent.querySelectorAll<HTMLElement>(".aero-slider__dot"));
    dots.forEach((dot, i) => {
      dot.setAttribute("role", "tab");
      dot.setAttribute("data-slide-index", String(i));
      dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
    });
    refresh();
  }

  /** Determine CSS class for dot based on position in windowed view */
  function getDotScaleClass(
    posInWindow: number,
    maxDots: number,
    atStart: boolean,
    atEnd: boolean
  ): string | null {
    if (posInWindow < 0 || posInWindow >= maxDots) {
      return "aero-slider__dot--hidden";
    }
    
    const atLeftEdge = posInWindow === 0;
    const atRightEdge = posInWindow === maxDots - 1;
    const nearLeftEdge = posInWindow === 1;
    const nearRightEdge = posInWindow === maxDots - 2;
    
    // Scale left edge only if not at pagination start
    if (atLeftEdge && !atStart) return "aero-slider__dot--edge";
    if (nearLeftEdge && !atStart) return "aero-slider__dot--near-edge";
    // Scale right edge only if not at pagination end
    if (atRightEdge && !atEnd) return "aero-slider__dot--edge";
    if (nearRightEdge && !atEnd) return "aero-slider__dot--near-edge";
    
    return null;
  }

  /** Clear all scale modifier classes from a dot */
  function clearDotScaleClasses(dot: HTMLElement): void {
    dot.classList.remove(
      "aero-slider__dot--hidden",
      "aero-slider__dot--edge",
      "aero-slider__dot--near-edge"
    );
  }

  function refresh(): void {
    const pageCount = getPageCount();
    const currentIndex = ctx.state.currentIndex;
    const maxDots = ctx.config.maxDots;
    
    if (isWindowed && maxDots > 0 && dotsTrack) {
      // iOS-style: translate track to center active dot
      const halfWindow = Math.floor(maxDots / 2);
      const dotUnit = dotSize + dotGap;
      
      // Calculate offset to center current dot, clamped to edges
      let targetOffset = currentIndex - halfWindow;
      targetOffset = Math.max(0, Math.min(targetOffset, pageCount - maxDots));
      
      // Use CSS custom property for track translation
      dotsTrack.style.setProperty("--track-offset", `${-targetOffset * dotUnit}px`);
      
      const atStart = targetOffset === 0;
      const atEnd = targetOffset >= pageCount - maxDots;
      
      // Update dot states using CSS classes
      dots.forEach((dot, i) => {
        const active = i === currentIndex;
        dot.classList.toggle("aero-slider__dot--active", active);
        dot.setAttribute("aria-selected", String(active));
        
        clearDotScaleClasses(dot);
        const scaleClass = getDotScaleClass(i - targetOffset, maxDots, atStart, atEnd);
        if (scaleClass) dot.classList.add(scaleClass);
      });
    } else {
      // Standard refresh - clear any windowed classes
      dots.forEach((dot, i) => {
        const active = i === currentIndex;
        dot.classList.toggle("aero-slider__dot--active", active);
        dot.setAttribute("aria-selected", String(active));
        clearDotScaleClasses(dot);
      });
    }
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
    const dir = ctx.config.direction;

    if (dir === "ttb") {
      if (e.key === "ArrowUp") { e.preventDefault(); prev(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); next(); }
    } else if (dir === "rtl") {
      if (e.key === "ArrowRight") { e.preventDefault(); prev(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); next(); }
    } else {
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
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
  let touchResumeTimer: ReturnType<typeof setTimeout> | null = null;

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

  function onTouchStart(): void {
    // Cancel any pending resume
    if (touchResumeTimer !== null) {
      clearTimeout(touchResumeTimer);
      touchResumeTimer = null;
    }
    pause();
  }

  function onTouchEnd(): void {
    // Resume autoplay after a delay to let scroll settle
    if (ctx.config.autoplay) {
      touchResumeTimer = setTimeout(() => {
        touchResumeTimer = null;
        if (ctx.config.autoplay) start();
      }, 1000); // 1 second delay after touch ends
    }
  }

  function setHoverPause(enabled: boolean): void {
    if (enabled === hoverListenersActive) return;
    if (enabled) {
      ctx.container.addEventListener("mouseenter", onMouseEnter);
      ctx.container.addEventListener("mouseleave", onMouseLeave);
      ctx.track.addEventListener("touchstart", onTouchStart, { passive: true });
      ctx.track.addEventListener("touchend", onTouchEnd, { passive: true });
      ctx.track.addEventListener("touchcancel", onTouchEnd, { passive: true });
      hoverListenersActive = true;
    } else {
      ctx.container.removeEventListener("mouseenter", onMouseEnter);
      ctx.container.removeEventListener("mouseleave", onMouseLeave);
      ctx.track.removeEventListener("touchstart", onTouchStart);
      ctx.track.removeEventListener("touchend", onTouchEnd);
      ctx.track.removeEventListener("touchcancel", onTouchEnd);
      if (touchResumeTimer !== null) {
        clearTimeout(touchResumeTimer);
        touchResumeTimer = null;
      }
      hoverListenersActive = false;
    }
  }

  return { start, pause, setHoverPause };
}
