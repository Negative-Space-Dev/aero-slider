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
// window of them shows, iOS style. The track does the sliding, so a theme is free to restyle and
// animate the dots themselves.

export function pagination(core: SliderCore) {
  const box = core.container.querySelector<HTMLElement>(".aero-slider__pagination");
  const template = box?.querySelector<HTMLElement>(".aero-slider__dot");
  if (!box || !template) return { build() {}, measure() {}, refresh() {} };
  return createPagination(core, box, template);
}

function createPagination(core: SliderCore, box: HTMLElement, template: HTMLElement) {
  const { config, signal } = core;
  const parent = template.parentNode!;
  const anchor = template.nextSibling;
  let dots: HTMLElement[] = [];
  let windowed = false;
  let dotTrack: HTMLElement | null = null;
  let dotPitch = 0; // distance between neighbouring dots; negative in RTL
  const name = template.getAttribute("aria-label");

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
    const count = core.stopCount();
    const { maxDots } = config;
    windowed = maxDots > 0 && count > maxDots;
    const holder = windowed ? document.createElement("div") : new DocumentFragment();
    for (let i = 0; i < count; i++) {
      const dot = template.cloneNode(true) as HTMLElement;
      const slide = core.slideOfStop(i);
      // The template names its dots: aria-label="Go to slide {index}".
      if (name) dot.setAttribute("aria-label", name.replace("{index}", String(slide + 1)));
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
    // With no dot focused this looks up dots[-1], which is nothing.
    dots[Math.min(focused, count - 1)]?.focus({ preventScroll: true });
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
    dotTrack?.style.setProperty("--track-offset", `${-firstShown * dotPitch}px`);

    const hidden: HTMLElement[] = [];
    dots.forEach((dot, i) => {
      const active = i === current;
      dot.classList.toggle("aero-slider__dot--active", active);
      if (active) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
      if (!windowed) return;

      // How far inside the window the dot sits: -1 is outside it, 0 its outermost dot, 1 the next
      // one in. A side of the window with no dots beyond it has no edge.
      const slot = i - firstShown;
      const depth = Math.min(
        firstShown ? slot : 9,
        firstShown < count - maxDots ? maxDots - 1 - slot : 9
      );
      ["hidden", "edge", "near-edge"].forEach((size, at) =>
        dot.classList.toggle(`aero-slider__dot--${size}`, at ? at === depth + 1 : depth < 0)
      );
      if (depth < 0) hidden.push(dot);
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
  // The container is the one tab stop. A scroller would otherwise be a second, unnamed one.
  for (const [el, index] of [
    [container, 0],
    [track, -1],
  ] as const) {
    if (el.hasAttribute("tabindex")) continue;
    el.tabIndex = index;
    signal.addEventListener("abort", () => el.removeAttribute("tabindex"));
  }
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
  width: number;
  animations: Animation[];
}

export function autoplay(core: SliderCore) {
  const { container, track, config, signal, reducedMotion } = core;
  const holds = new Set<string>();
  const continuous = () => config.autoplay === "continuous";
  let timer = 0;
  let lap: Lap | null = null;
  let running = false; // autoplayStart has been announced and autoplayStop hasn't followed it
  let settleFallback = 0;
  const pressed = new Set<number>(); // pointerIds currently down on the track
  let advancing = false; // the slide change under way is autoplay's own

  /** Announces a change of state only: a lap swapped on resize stays running throughout. */
  function announce(on: boolean): void {
    if (running === on) return;
    running = on;
    core.emit(on ? "autoplayStart" : "autoplayStop", {});
  }
  // Scrolling changes nothing a screen reader can hear, so a hidden status line names the slide
  // the user moved to. It stays quiet for the moves autoplay makes on its own.
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
    advancing = true;
    if (atEnd) core.goTo(0);
    else core.next();
    advancing = false;
  }

  function travelled(current: Lap): number {
    const time = Number(current.animations[0]?.currentTime) || 0;
    return ((time * config.autoplaySpeed) / 1000) % current.width;
  }

  function startLap(): void {
    const cycle = core.cycle();
    if (!cycle) return;
    const { start, width } = cycle;
    // The same view one lap earlier or later, inside the teleport-safe band.
    const base = start + ((((core.position() - start) % width) + width) % width);
    if (base + width > core.maxScroll()) return; // too few clones to cover a lap
    if (Math.abs(base - core.position()) > 0.5) core.jumpTo(base);

    const distance = (core.isRtl() ? 1 : -1) * width;
    const to = core.isVertical() ? `0 ${distance}px` : `${distance}px 0`;
    const duration = (width / config.autoplaySpeed) * 1000;
    const startTime = document.timeline.currentTime;
    const animations = Array.from(track.children, (slide) => {
      const animation = slide.animate([{ translate: "0 0" }, { translate: to }], {
        duration,
        iterations: Infinity,
      });
      animation.startTime = startTime;
      return animation;
    });
    lap = { width, animations };
  }

  /**
   * Ends the lap, handing its travel back to the scroll offset unless the layout is stale. It isn't
   * folded a lap back: the same cards stay under the pointer and keyboard focus, so a click on a
   * product link lands on the link that was pressed. Laps start inside the band and the runway
   * covers a full lap past it, so the unfolded offset is always reachable.
   */
  function stopLap(handBack: boolean): void {
    if (!lap) return;
    const current = lap;
    lap = null;
    const position = core.position() + travelled(current);
    for (const animation of current.animations) animation.cancel();
    if (handBack) core.jumpTo(position);
  }

  function start(): void {
    if (!blocked()) {
      if (!continuous()) timer ||= countdown();
      else if (!lap) startLap();
    }
    // A lap reset quietly for a resize that can't restart now still owes its autoplayStop.
    announce(!!(timer || lap));
  }

  /** A fresh interval before the next automatic move. */
  function countdown(): number {
    clearInterval(timer);
    return (timer = window.setInterval(advance, config.autoplayInterval));
  }

  function stop(handBack = true): void {
    clearInterval(timer);
    timer = 0;
    stopLap(handBack);
    announce(false);
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
    if (event.target !== container) return; // a nested slider's change
    if (timer) countdown();
    const { index } = (event as CustomEvent<{ index: number }>).detail;
    // data-aero-status on the container words it for other languages.
    status.textContent = advancing
      ? ""
      : (container.dataset.aeroStatus ?? "{index} of {count}")
          .replace("{index}", String(index + 1))
          .replace(
            "{count}",
            String(track.querySelectorAll(":scope > [data-aero-slider-index]").length)
          );
  });
  listen(document, "visibilitychange", () => (document.hidden ? stop() : start()));
  listen(reducedMotion, "change", () => (reducedMotion.matches ? stop() : start()));
  signal.addEventListener("abort", () => {
    status.remove();
    clearTimeout(settleFallback);
    stop(false);
  });

  return {
    start,
    /** After a rebuild: a running interval gets a fresh countdown without announcing a restart. */
    restart(): void {
      if (timer && !blocked() && !continuous()) return void countdown();
      clearInterval(timer);
      timer = 0;
      start();
    },
    hold,
    release,
    /** A continuous lap is moving the slides right now. */
    drifting: () => lap !== null,
    /**
     * Ends a lap without handing it back, for when the layout is about to change under it. A
     * rebuild can change the slide count, so it also drops the status text, which
     * would otherwise go on naming the old one until the next slide change.
     */
    reset(rebuilding?: boolean): void {
      stopLap(false);
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
