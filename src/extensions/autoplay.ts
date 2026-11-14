import type { SliderCore } from "../slider.ts";

// ── Autoplay ───────────────────────────────────────────────────────────
// Both kinds of autoplay loop, so this extension needs the loop extension too: setting autoplay
// turns looping on.
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

  /** Announces a change of state only: a lap swapped on resize stays running throughout. */
  function announce(on: boolean): void {
    if (running === on) return;
    running = on;
    core.emit(on ? "autoplayStart" : "autoplayStop", {});
  }

  const blocked = () =>
    signal.aborted ||
    !config.autoplay ||
    holds.size > 0 ||
    document.hidden ||
    reducedMotion.matches ||
    (continuous() && !(config.autoplaySpeed > 0)); // a ticker at 0 px/s stays still

  function advance(): void {
    if (core.easing()) return; // scrollDuration outlasts the interval: let the move land first
    core.quiet = true; // the status line names only the moves a user makes
    core.next();
    core.quiet = false;
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
  });
  listen(document, "visibilitychange", () => (document.hidden ? stop() : start()));
  listen(reducedMotion, "change", () => (reducedMotion.matches ? stop() : start()));
  signal.addEventListener("abort", () => {
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
    /** Ends a lap without handing it back, for when the layout is about to change under it. */
    reset: () => stopLap(false),
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

export type Autoplay = ReturnType<typeof autoplay>;
