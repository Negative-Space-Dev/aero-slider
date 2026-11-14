import type { SliderCore } from "./slider.ts";
import type { DotWindow } from "./extensions/dots.ts";

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
// and a copy of it stands in per stop. The maxDots extension shows a sliding window of them.

export function pagination(core: SliderCore, windowing?: (core: SliderCore) => DotWindow) {
  const box = core.container.querySelector<HTMLElement>(".aero-slider__pagination");
  const template = box?.querySelector<HTMLElement>(".aero-slider__dot");
  if (!box || !template) return { build() {}, measure() {}, refresh() {} };
  return createPagination(core, box, template, windowing?.(core));
}

function createPagination(
  core: SliderCore,
  box: HTMLElement,
  template: HTMLElement,
  dotWindow?: DotWindow
) {
  const { signal } = core;
  const parent = template.parentNode!;
  const anchor = template.nextSibling;
  let dots: HTMLElement[] = [];
  const name = template.getAttribute("aria-label");

  function clear(): void {
    for (const dot of dots) dot.remove();
    dotWindow?.clear(box);
    dots = [];
  }

  function build(): void {
    // Rebuilding removes the dot that has focus, which would drop a keyboard user on the page.
    const focused = dots.indexOf(document.activeElement as HTMLElement);
    clear();
    const count = core.stopCount();
    const holder = new DocumentFragment();
    for (let i = 0; i < count; i++) {
      const dot = template.cloneNode(true) as HTMLElement;
      const slide = core.slideOfStop(i);
      // The template names its dots: aria-label="Go to slide {index}".
      if (name) dot.setAttribute("aria-label", name.replace("{index}", String(slide + 1)));
      dot.dataset.slideIndex = String(slide);
      holder.append(dot);
      dots.push(dot);
    }
    parent.insertBefore(dotWindow?.wrap(box, holder, dots) ?? holder, anchor);
    measure();
    // With no dot focused this looks up dots[-1], which is nothing.
    dots[Math.min(focused, count - 1)]?.focus({ preventScroll: true });
  }

  /** Sizes a dot window. Everything measures 0 while hidden, so it reruns on every relayout. */
  function measure(): void {
    dotWindow?.measure(box, dots);
    refresh();
  }

  function refresh(): void {
    const current = core.stop();
    dots.forEach((dot, i) => {
      const active = i === current;
      dot.classList.toggle("aero-slider__dot--active", active);
      if (active) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
    dotWindow?.refresh(dots, current);
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
