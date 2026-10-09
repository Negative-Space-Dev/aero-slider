import type { SliderCore } from "./slider.ts";

// ── Prev / next buttons ────────────────────────────────────────────────

export function navigation(core: SliderCore) {
  const { container, signal } = core;
  const prevButton = container.querySelector<HTMLButtonElement>(".aero-slider__nav--prev");
  const nextButton = container.querySelector<HTMLButtonElement>(".aero-slider__nav--next");
  prevButton?.addEventListener("click", core.prev, { signal });
  nextButton?.addEventListener("click", core.next, { signal });

  return {
    refresh(): void {
      const singlePage = core.maxIndex() === 0;
      const hasEdges = !core.loop();
      if (prevButton) prevButton.disabled = singlePage || (hasEdges && core.current() === 0);
      if (nextButton) {
        nextButton.disabled = singlePage || (hasEdges && core.current() >= core.maxIndex());
      }
    },
  };
}

// ── Pagination dots ────────────────────────────────────────────────────
// The markup supplies one .aero-slider__dot as a template; we clone it per
// page. With maxDots set, the dots sit in a sliding track and only a window
// of them shows, iOS style.

export function pagination(core: SliderCore) {
  const box = core.container.querySelector<HTMLElement>(".aero-slider__pagination");
  const template = box?.querySelector<HTMLElement>(".aero-slider__dot");
  if (!box || !template) return { build() {}, refresh() {} };
  return createPagination(core, box, template);
}

function createPagination(core: SliderCore, box: HTMLElement, template: HTMLElement) {
  const { config, signal } = core;
  let dots: HTMLElement[] = [];
  let windowed = false;
  let dotTrack: HTMLElement | null = null;
  let dotPitch = 0; // distance between neighbouring dots; negative in RTL

  function clear(): void {
    for (const dot of dots) if (dot !== template) dot.remove();
    dotTrack?.remove();
    dotTrack = null;
    dots = [];
    template.style.display = "";
    box.classList.remove("aero-slider__pagination--windowed");
    box.style.removeProperty("--pagination-width");
  }

  function build(): void {
    clear();
    const count = core.pageCount();
    const { maxDots } = config;
    windowed = maxDots > 0 && count > maxDots;
    if (windowed) {
      dotTrack = document.createElement("div");
      dotTrack.className = "aero-slider__pagination-track";
    }
    const parent = dotTrack ?? box;

    for (let i = 0; i < count; i++) {
      const dot = !windowed && i === 0 ? template : (template.cloneNode(true) as HTMLElement);
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
      dot.dataset.slideIndex = String(i);
      if (dot !== template) parent.append(dot);
      dots.push(dot);
    }

    if (dotTrack) {
      template.style.display = "none";
      box.classList.add("aero-slider__pagination--windowed");
      box.append(dotTrack);
      dotPitch = dots[1]!.offsetLeft - dots[0]!.offsetLeft;
      const width = (maxDots - 1) * Math.abs(dotPitch) + dots[0]!.offsetWidth;
      box.style.setProperty("--pagination-width", `${width}px`);
    }
    refresh();
  }

  function refresh(): void {
    const current = core.current();
    const count = dots.length;
    const { maxDots } = config;
    const firstShown = windowed
      ? Math.max(0, Math.min(current - Math.floor(maxDots / 2), count - maxDots))
      : 0;
    const atStart = firstShown === 0;
    const atEnd = firstShown >= count - maxDots;
    dotTrack?.style.setProperty("--track-offset", `${-firstShown * dotPitch}px`);

    dots.forEach((dot, i) => {
      const active = i === current;
      dot.classList.toggle("aero-slider__dot--active", active);
      dot.setAttribute("aria-selected", String(active));
      if (!windowed) return;

      const slot = i - firstShown;
      const size =
        slot < 0 || slot >= maxDots
          ? "hidden"
          : (slot === 0 && !atStart) || (slot === maxDots - 1 && !atEnd)
            ? "edge"
            : (slot === 1 && !atStart) || (slot === maxDots - 2 && !atEnd)
              ? "near-edge"
              : "";
      dot.classList.remove(
        "aero-slider__dot--hidden",
        "aero-slider__dot--edge",
        "aero-slider__dot--near-edge"
      );
      if (size) dot.classList.add(`aero-slider__dot--${size}`);
    });
  }

  box.setAttribute("role", "tablist");
  box.addEventListener(
    "click",
    (event) => {
      const dot = (event.target as Element).closest<HTMLElement>(".aero-slider__dot");
      if (dot?.dataset.slideIndex) core.goTo(Number(dot.dataset.slideIndex));
    },
    { signal }
  );
  signal.addEventListener("abort", clear);

  return { build, refresh };
}

// ── Keyboard ───────────────────────────────────────────────────────────

export function keyboard(core: SliderCore): void {
  const { container, signal } = core;
  if (!container.hasAttribute("tabindex")) {
    container.tabIndex = 0;
    signal.addEventListener("abort", () => container.removeAttribute("tabindex"));
  }
  container.addEventListener(
    "keydown",
    (event) => {
      if ((event.target as Element).closest("input, textarea, select, [contenteditable]")) return;
      const { direction } = core.config;
      const [back, forward] =
        direction === "ttb"
          ? ["ArrowUp", "ArrowDown"]
          : direction === "rtl"
            ? ["ArrowRight", "ArrowLeft"]
            : ["ArrowLeft", "ArrowRight"];
      if (event.key === back) core.prev();
      else if (event.key === forward) core.next();
      else return;
      event.preventDefault();
    },
    { signal }
  );
}

// ── Autoplay ───────────────────────────────────────────────────────────
// Interval autoplay advances one move per autoplayInterval, restarting its countdown whenever the
// slide changes. Continuous autoplay drifts every slide with one shared compositor animation, so
// main-thread work never stalls it; each lap travels exactly one set of slides and the clones on
// either side make the restart seamless. Native scrolling simply adds to the drift, and anything
// that needs the real offset (a press, goTo(), a resize) gets the lap handed back first.
//
// Both pause while pressed, while keyboard focus is inside, during a drag, while the tab is hidden,
// and on pause(); interval autoplay also pauses on hover. Neither runs under
// prefers-reduced-motion, and both stop as soon as it is turned on. After a press or goTo(), they
// resume once scrolling settles.

const SETTLE_FALLBACK_MS = 150; // resume a press that never scrolled

interface Lap {
  start: number;
  width: number;
  duration: number;
  animations: Animation[];
}

export function autoplay(core: SliderCore) {
  const { container, track, config, signal, reducedMotion } = core;
  const holds = new Set<string>();
  const continuous = () => config.autoplay === "continuous";
  let timer = 0;
  let lap: Lap | null = null;
  let running = false; // autoplayStart has been announced; a lap swapped on resize doesn't re-announce
  let settleFallback = 0;
  const pressed = new Set<number>(); // pointerIds currently down on the track

  const blocked = () =>
    signal.aborted ||
    !config.autoplay ||
    holds.size > 0 ||
    document.hidden ||
    reducedMotion.matches ||
    (continuous() && !(config.autoplaySpeed > 0)); // a ticker at 0 px/s stays still

  function advance(): void {
    if (core.easing()) return; // scrollDuration outlasts the interval: let the move land first
    const atEnd = !core.loop() && core.current() >= core.maxIndex();
    if (atEnd) core.goTo(0);
    else core.next();
  }

  /** The same view one lap earlier or later, inside the teleport-safe band. */
  function fold(position: number, { start, width }: { start: number; width: number }): number {
    while (position < start) position += width;
    while (position >= start + width) position -= width;
    return position;
  }

  function travelled(current: Lap): number {
    const time = Number(current.animations[0]?.currentTime) || 0;
    return ((time % current.duration) / current.duration) * current.width;
  }

  function startLap(): void {
    const cycle = core.cycle();
    if (!cycle) return;
    const base = fold(core.position(), cycle);
    if (base + cycle.width > core.maxScroll()) return; // too few clones to cover a lap
    if (Math.abs(base - core.position()) > 0.5) core.jumpTo(base);

    const distance = (core.isRtl() ? 1 : -1) * cycle.width;
    const to = core.isVertical() ? `0 ${distance}px` : `${distance}px 0`;
    const duration = (cycle.width / config.autoplaySpeed) * 1000;
    const startTime = document.timeline.currentTime;
    const animations = Array.from(track.children, (slide) => {
      const animation = slide.animate([{ translate: "0 0" }, { translate: to }], {
        duration,
        iterations: Infinity,
      });
      animation.startTime = startTime;
      return animation;
    });
    lap = { ...cycle, duration, animations };
    if (!running) {
      running = true;
      core.emit("autoplayStart", {});
    }
  }

  /**
   * Ends the lap, handing its travel back to the scroll offset unless the layout is stale. It isn't
   * folded a lap back: the same cards stay under the pointer and keyboard focus, so a click on a
   * product link lands on the link that was pressed. Laps start inside the band and the runway
   * covers a full lap past it, so the unfolded offset is always reachable.
   */
  function stopLap(handBack: boolean, announce = true): void {
    if (!lap) return;
    const current = lap;
    lap = null;
    const position = handBack ? core.position() + travelled(current) : null;
    for (const animation of current.animations) animation.cancel();
    if (position !== null) core.jumpTo(position);
    if (announce && running) {
      running = false;
      core.emit("autoplayStop", {});
    }
  }

  function start(): void {
    if (blocked()) {
      // A lap reset quietly for a resize that can't restart now still owes its autoplayStop.
      if (running && !lap) {
        running = false;
        core.emit("autoplayStop", {});
      }
      return;
    }
    if (continuous()) {
      if (!lap) startLap();
    } else if (!timer) {
      timer = window.setInterval(advance, config.autoplayInterval);
      core.emit("autoplayStart", {});
    }
  }

  function stopInterval(): void {
    if (!timer) return;
    clearInterval(timer);
    timer = 0;
    core.emit("autoplayStop", {});
  }

  function stop(): void {
    stopInterval();
    stopLap(true);
  }

  function hold(reason: string): void {
    holds.add(reason);
    stop();
  }

  function release(reason: string): void {
    holds.delete(reason);
    start();
  }

  /** Holds until the next scroll settles, or briefly if nothing scrolls at all. */
  function holdUntilSettled(): void {
    hold("settle");
    clearTimeout(settleFallback);
    settleFallback = window.setTimeout(() => release("settle"), SETTLE_FALLBACK_MS);
  }

  const listen = (target: EventTarget, type: string, handler: (event: Event) => void) =>
    target.addEventListener(type, handler, { passive: true, signal });
  // A ticker keeps drifting under the pointer; only interval autoplay pauses on hover.
  listen(container, "pointerenter", () => !continuous() && hold("pointer"));
  listen(container, "pointerleave", () => release("pointer"));
  listen(track, "pointerdown", (event) => {
    if (!config.autoplay) return;
    pressed.add((event as PointerEvent).pointerId);
    hold("press");
  });
  // Releases are caught on window in the capture phase, so they count wherever the pointer is
  // and even if content inside a slide stops them. The hold lasts until the last pointer lifts.
  const onRelease = (event: Event) => {
    if (event.type === "dragend" || event.type === "pointermove") {
      // A native drag (a link or image) swallows the pointerup: its dragend, or the pointer coming
      // back with no button held, means the press is over.
      if (!pressed.size || (event as PointerEvent).buttons) return;
      pressed.clear();
    } else if (!pressed.delete((event as PointerEvent).pointerId) || pressed.size) return;
    holds.delete("press");
    holdUntilSettled();
  };
  for (const type of ["pointerup", "pointercancel", "pointermove", "dragend"]) {
    addEventListener(type, onRelease, { capture: true, passive: true, signal });
  }
  listen(container, "focusin", (event) => {
    if ((event.target as Element).matches(":focus-visible")) hold("focus");
  });
  listen(container, "focusout", (event) => {
    if (!container.contains((event as FocusEvent).relatedTarget as Node)) release("focus");
  });
  // A manual change earns a full interval before the next automatic one.
  listen(container, "aero:slideChange", (event) => {
    if (event.target !== container || !timer) return; // not a nested slider's change
    clearInterval(timer);
    timer = window.setInterval(advance, config.autoplayInterval);
  });
  listen(document, "visibilitychange", () => (document.hidden ? stop() : start()));
  listen(reducedMotion, "change", () => (reducedMotion.matches ? stop() : start()));
  signal.addEventListener("abort", () => {
    clearTimeout(settleFallback);
    stopInterval();
    stopLap(false);
  });

  return {
    start,
    stop,
    hold,
    release,
    /** Ends a lap without handing it back, for when the layout is about to change under it. */
    reset(): void {
      stopLap(false, false);
    },
    /** goTo() is about to measure from the scroll offset. True if a lap was handed back. */
    interrupt(): boolean {
      if (!lap) return false;
      holdUntilSettled();
      return true;
    },
    /** A scroll is under way, so wait for it to settle rather than the fallback. */
    scrolled(): void {
      if (holds.has("settle")) clearTimeout(settleFallback);
      // A wheel scroll during a lap adds to the drift. Only if it carries the view to within a
      // slide of the end of the track does it jump back a lap (which looks identical): jumping any
      // sooner cuts the browser's smooth wheel animation short for nothing.
      if (lap) {
        const position = core.position();
        const margin = lap.width / core.pageCount();
        if (position + travelled(lap) > core.maxScroll() - margin)
          core.jumpTo(position - lap.width);
      }
    },
    settled(): void {
      clearTimeout(settleFallback);
      if (holds.has("settle")) release("settle");
    },
  };
}
