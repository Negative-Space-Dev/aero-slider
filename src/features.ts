import type { SliderCore } from "./slider.ts";

// ── Prev / next buttons ────────────────────────────────────────────────

export function navigation(core: SliderCore) {
  const { container, signal } = core;
  const prevButton = container.querySelector<HTMLButtonElement>(".aero-slider__nav--prev");
  const nextButton = container.querySelector<HTMLButtonElement>(".aero-slider__nav--next");
  prevButton?.addEventListener("click", core.prev, { signal });
  nextButton?.addEventListener("click", core.next, { signal });

  const buttons = [prevButton, nextButton];
  const initial = buttons.map((button) => button?.disabled);
  signal.addEventListener("abort", () =>
    buttons.forEach((button, i) => button && (button.disabled = initial[i]!))
  );

  return {
    refresh(): void {
      const last = core.stopCount() - 1;
      const stop = core.stop();
      const hasEdges = !core.loop();
      const off = [last < 1 || (hasEdges && stop <= 0), last < 1 || (hasEdges && stop >= last)];
      // Enable first: a button about to take focus must already be able to hold it.
      buttons.forEach((button, i) => button && !off[i] && (button.disabled = false));
      buttons.forEach((button, i) => {
        if (!button || !off[i]) return;
        // A focused button that disables would drop focus to the page. The page may have been
        // scrolled away since the click, so the hand-over must not scroll it back.
        if (button === document.activeElement) {
          ((!off[1 - i] && buttons[1 - i]) || container).focus({ preventScroll: true });
        }
        button.disabled = true;
      });
    },
  };
}

// ── Pagination dots ────────────────────────────────────────────────────
// The markup supplies one .aero-slider__dot as a template. It leaves the page while the slider runs,
// and a copy of it stands in per stop. With maxDots set, the dots sit in a sliding track and only a
// window of them shows, iOS style.

export function pagination(core: SliderCore) {
  const box = core.container.querySelector<HTMLElement>(".aero-slider__pagination");
  const template = box?.querySelector<HTMLElement>(".aero-slider__dot");
  if (!box || !template) return { build() {}, measure() {}, refresh() {} };
  return createPagination(core, box, template);
}

/** Enter and Space click a target that `is` accepts, the way they press a native button. */
export function pressable(
  root: HTMLElement,
  is: (target: Element) => boolean,
  signal: AbortSignal
): void {
  root.addEventListener(
    "keydown",
    (event) => {
      const target = event.target as HTMLElement;
      if ((event.key === "Enter" || event.key === " ") && is(target)) {
        event.preventDefault();
        target.click();
      }
    },
    { signal }
  );
}

function createPagination(core: SliderCore, box: HTMLElement, template: HTMLElement) {
  const { config, signal } = core;
  const parent = template.parentNode!;
  const anchor = template.nextSibling;
  let dots: HTMLElement[] = [];
  let windowed = false;
  let dotTrack: HTMLElement | null = null;
  let dotPitch = 0; // distance between neighbouring dots; negative in RTL

  function clear(): void {
    for (const dot of dots) dot.remove();
    dotTrack?.remove();
    dotTrack = null;
    dots = [];
    box.classList.remove("aero-slider__pagination--windowed");
    box.style.removeProperty("--pagination-width");
  }

  function build(): void {
    // Rebuilding removes the dot that has focus, which would drop a keyboard user on the page.
    const focused = dots.indexOf(document.activeElement as HTMLElement);
    clear();
    core.attr(box, "role", "group");
    core.attr(box, "aria-label", core.label("pagination"));
    const count = core.stopCount();
    const { maxDots } = config;
    windowed = maxDots > 0 && count > maxDots;
    const holder = windowed ? document.createElement("div") : new DocumentFragment();
    for (let i = 0; i < count; i++) {
      const dot = template.cloneNode(true) as HTMLElement;
      if (dot.localName !== "button") {
        if (!dot.hasAttribute("role")) dot.setAttribute("role", "button");
        if (!dot.hasAttribute("tabindex")) dot.tabIndex = 0;
      }
      const slide = core.slideOfStop(i);
      dot.setAttribute("aria-label", core.label("dot", slide));
      dot.dataset.slideIndex = String(slide);
      holder.append(dot);
      dots.push(dot);
    }
    if (windowed) {
      dotTrack = holder as HTMLElement;
      dotTrack.className = "aero-slider__pagination-track";
      box.classList.add("aero-slider__pagination--windowed");
    }
    parent.insertBefore(holder, anchor);
    measure();
    if (focused >= 0) dots[Math.min(focused, count - 1)]?.focus({ preventScroll: true });
  }

  /** Sizes the dot window. Everything measures 0 while hidden, so it reruns on every relayout. */
  function measure(): void {
    if (dotTrack) {
      dotPitch = dots[1]!.offsetLeft - dots[0]!.offsetLeft;
      const width = (config.maxDots - 1) * Math.abs(dotPitch) + dots[0]!.offsetWidth;
      box.style.setProperty("--pagination-width", `${width}px`);
    }
    refresh();
  }

  function refresh(): void {
    const current = core.stop();
    const count = dots.length;
    const { maxDots } = config;
    const firstShown = windowed
      ? Math.max(0, Math.min(current - Math.floor(maxDots / 2), count - maxDots))
      : 0;
    const atStart = firstShown === 0;
    const atEnd = firstShown >= count - maxDots;
    dotTrack?.style.setProperty("--track-offset", `${-firstShown * dotPitch}px`);

    const hidden: HTMLElement[] = [];
    dots.forEach((dot, i) => {
      const active = i === current;
      dot.classList.toggle("aero-slider__dot--active", active);
      if (active) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
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
      if (size === "hidden") hidden.push(dot);
      else dot.inert = false;
    });
    // A dot leaving the tab order hands focus to the current one, which must be focusable first:
    // End from the first dot lands on one that was outside the window a moment ago.
    if (hidden.includes(document.activeElement as HTMLElement)) {
      dots[current]!.focus({ preventScroll: true });
    }
    for (const dot of hidden) dot.inert = true;
  }

  template.remove();
  box.addEventListener(
    "click",
    (event) => {
      const dot = (event.target as Element).closest<HTMLElement>(".aero-slider__dot");
      if (dot?.dataset.slideIndex) core.goTo(Number(dot.dataset.slideIndex));
    },
    { signal }
  );
  pressable(box, (target) => dots.includes(target as HTMLElement), signal);
  signal.addEventListener("abort", () => {
    clear();
    if (!box.getAttribute("style")) box.removeAttribute("style");
    parent.insertBefore(template, anchor);
  });

  return { build, measure, refresh };
}

// ── Keyboard ───────────────────────────────────────────────────────────

export function keyboard(core: SliderCore): void {
  const { container, track, signal } = core;
  core.attr(container, "tabindex", "0");
  core.attr(track, "tabindex", "-1"); // a scroller is otherwise a second, unnamed tab stop
  container.addEventListener(
    "keydown",
    (event) => {
      // Keys belong to whatever has focus inside a slide, and to a nested slider's own controls.
      const target = event.target as Element;
      const own =
        target === container ||
        target === track ||
        (target.matches(".aero-slider__nav--prev, .aero-slider__nav--next, .aero-slider__dot") &&
          target.closest(".aero-slider") === container);
      if (!own || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.shiftKey) return;
      const [back, forward] = core.isVertical()
        ? ["ArrowUp", "ArrowDown"]
        : core.isRtl()
          ? ["ArrowRight", "ArrowLeft"]
          : ["ArrowLeft", "ArrowRight"];
      const stop = core.stop();
      const last = core.stopCount() - 1;
      const to = { [back]: stop - 1, [forward]: stop + 1, Home: 0, End: last }[event.key];
      // Off a loop, a key with nowhere to go keeps its default, so the page can scroll on.
      if (to === undefined || (!core.loop() && (to < 0 || to > last || to === stop))) return;
      if (event.key === back) core.prev();
      else if (event.key === forward) core.next();
      else core.goTo(core.slideOfStop(to));
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

  const announce = (on: boolean) => core.emit(on ? "autoplayStart" : "autoplayStop", {});
  // Scrolling changes nothing a screen reader can hear, so a hidden status line names the slide
  // the user moved to. It stays quiet while autoplay moves the slides on its own.
  const status = document.createElement("div");
  status.className = "aero-slider__status";
  status.setAttribute("aria-live", "polite");
  container.append(status);

  const blocked = () =>
    signal.aborted ||
    !config.autoplay ||
    holds.size > 0 ||
    document.hidden ||
    reducedMotion.matches ||
    (continuous() && !(config.autoplaySpeed > 0)); // a ticker at 0 px/s stays still

  function advance(): void {
    if (core.easing()) return; // scrollDuration outlasts the interval: let the move land first
    const atEnd = !core.loop() && core.stop() >= core.stopCount() - 1;
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
      announce(true);
    }
  }

  /**
   * Ends the lap, handing its travel back to the scroll offset unless the layout is stale. It isn't
   * folded a lap back: the same cards stay under the pointer and keyboard focus, so a click on a
   * product link lands on the link that was pressed. Laps start inside the band and the runway
   * covers a full lap past it, so the unfolded offset is always reachable.
   */
  function stopLap(handBack: boolean, loud = true): void {
    if (!lap) return;
    const current = lap;
    lap = null;
    const position = handBack ? core.position() + travelled(current) : null;
    for (const animation of current.animations) animation.cancel();
    if (position !== null) core.jumpTo(position);
    if (loud && running) {
      running = false;
      announce(false);
    }
  }

  /** The optional pause button and the paused class follow the hold pause() puts on. */
  function paint(): void {
    const paused = holds.has("api");
    container.classList.toggle("aero-slider--paused", paused);
    if (!button) return;
    // Nothing autoplays under reduced motion, so there is nothing to pause.
    core.attr(button, "hidden", config.autoplay && !reducedMotion.matches ? null : "");
    // A name we supply says what a press will do. A button with its own name keeps it and
    // carries the state in aria-pressed.
    const named =
      !button.textContent!.trim() &&
      !button.hasAttribute("aria-labelledby") &&
      core.attr(button, "aria-label", core.label(paused ? "play" : "pause"));
    if (!named) button.setAttribute("aria-pressed", String(paused));
  }

  function start(): void {
    paint();
    if (blocked()) {
      // A lap reset quietly for a resize that can't restart now still owes its autoplayStop.
      if (running && !lap) {
        running = false;
        announce(false);
      }
      return;
    }
    if (continuous()) {
      if (!lap) startLap();
    } else if (!timer) {
      countdown();
      announce(true);
    }
  }

  /** A fresh interval before the next automatic move. */
  function countdown(): void {
    clearInterval(timer);
    timer = window.setInterval(advance, config.autoplayInterval);
  }

  function stopInterval(): void {
    if (!timer) return;
    clearInterval(timer);
    timer = 0;
    announce(false);
  }

  function stop(): void {
    stopInterval();
    stopLap(true);
  }

  function hold(reason: string): void {
    holds.add(reason);
    paint();
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

  // A nested slider's button belongs to that slider.
  const button = [...container.querySelectorAll(".aero-slider__autoplay")].find(
    (el) => el.closest(".aero-slider") === container
  );
  const pressedBefore = button?.getAttribute("aria-pressed");
  button?.addEventListener(
    "click",
    () => {
      if (!holds.has("api")) return hold("api");
      // Starting autoplay from the keyboard: the focus that reached the button mustn't hold it.
      holds.delete("focus");
      release("api");
    },
    { signal }
  );

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
    if (event.target !== container) return; // a nested slider's change
    if (timer) countdown();
    const { index } = (event as CustomEvent<{ index: number }>).detail;
    status.textContent = timer || lap ? "" : core.label("slidePosition", index);
  });
  listen(document, "visibilitychange", () => (document.hidden ? stop() : start()));
  listen(reducedMotion, "change", () => {
    if (reducedMotion.matches) stop();
    else start();
    paint();
  });
  signal.addEventListener("abort", () => {
    status.remove();
    if (button && pressedBefore == null) button.removeAttribute("aria-pressed");
    else button?.setAttribute("aria-pressed", pressedBefore!);
    clearTimeout(settleFallback);
    stopInterval();
    stopLap(false);
  });

  return {
    start,
    stop,
    /** After a rebuild: a running interval gets a fresh countdown without announcing a restart. */
    restart(): void {
      if (timer && !blocked() && !continuous()) return countdown();
      stopInterval();
      start();
    },
    hold,
    release,
    /** A continuous lap is moving the slides right now. */
    drifting: () => lap !== null,
    /**
     * Ends a lap without handing it back, for when the layout is about to change under it. A
     * rebuild can change the slide count or the labels, so it also drops the status text, which
     * would otherwise go on naming the old ones until the next slide change.
     */
    reset(rebuilding?: boolean): void {
      stopLap(false, false);
      if (rebuilding) status.textContent = "";
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
        const margin = lap.width / core.stopCount();
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
