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
// Pauses while the pointer is over the slider, while keyboard focus is inside,
// during a drag, and while the tab is hidden. Never runs under
// prefers-reduced-motion, and stops as soon as it is turned on.

export function autoplay(core: SliderCore) {
  const { container, config, signal, reducedMotion } = core;
  const holds = new Set<string>();
  let timer = 0;

  function start(): void {
    if (timer || !config.autoplay || holds.size || document.hidden || reducedMotion.matches) return;
    timer = window.setInterval(advance, config.autoplayInterval);
    core.emit("autoplayStart", {});
  }

  function stop(): void {
    if (!timer) return;
    clearInterval(timer);
    timer = 0;
    core.emit("autoplayStop", {});
  }

  function advance(): void {
    const atEnd = !core.loop() && core.current() >= core.maxIndex();
    if (atEnd) core.goTo(0);
    else core.next();
  }

  function hold(reason: string): void {
    holds.add(reason);
    stop();
  }

  function release(reason: string): void {
    holds.delete(reason);
    start();
  }

  const listen = (target: EventTarget, type: string, handler: (event: Event) => void) =>
    target.addEventListener(type, handler, { passive: true, signal });
  listen(container, "pointerenter", () => hold("pointer"));
  listen(container, "pointerleave", () => release("pointer"));
  listen(container, "focusin", (event) => {
    if ((event.target as Element).matches(":focus-visible")) hold("focus");
  });
  listen(container, "focusout", (event) => {
    if (!container.contains((event as FocusEvent).relatedTarget as Node)) release("focus");
  });
  listen(document, "visibilitychange", () => (document.hidden ? stop() : start()));
  listen(reducedMotion, "change", () => (reducedMotion.matches ? stop() : start()));
  signal.addEventListener("abort", stop);

  return { start, stop, hold, release };
}
