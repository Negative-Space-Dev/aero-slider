import { createSlider } from "aero-slider";
import type { SliderConfig, SliderEvent } from "aero-slider";
import { controlActions } from "../data/api";
import { getRequiredElementById } from "../lib/dom";
import { createSlideElement } from "../lib/slide";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

function controlDemo(): void {
  const root = getRequiredElementById("api-console");
  const el = getRequiredElementById("api-control-slider");
  const config: SliderConfig = { loop: true, autoplay: true, autoplayInterval: 2500 };
  const readout = (name: string) => root.querySelector<HTMLElement>(`[data-readout="${name}"]`)!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>("button[data-action]")];

  const showAutoplay = (running: boolean) => {
    readout("autoplay").textContent = running
      ? "running"
      : reducedMotion.matches
        ? "off: reduced motion"
        : "held";
  };
  el.addEventListener("aero:autoplayStart", () => showAutoplay(true));
  el.addEventListener("aero:autoplayStop", () => showAutoplay(false));
  showAutoplay(false);

  let slider = createSlider(el, config);
  // destroy() deletes the property, so it says whether this instance is still running.
  const live = () => el.aeroSlider === slider;

  function render(): void {
    const running = live();
    root.toggleAttribute("data-live", running);
    readout("index").textContent = running ? String(slider.currentIndex) : "–";
    readout("count").textContent = running ? String(slider.slideCount) : "–";
    if (!running) readout("autoplay").textContent = "–";
    for (const button of buttons) {
      const action = controlActions[Number(button.dataset.action)]!;
      button.disabled =
        action.needs !== (running ? "live" : "destroyed") ||
        (running && slider.slideCount < (action.minSlides ?? 0));
    }
  }

  el.addEventListener("aero:slideChange", render);
  root.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-action]");
    if (!button) return;
    const action = controlActions[Number(button.dataset.action)]!;
    const created = action.run({
      slider,
      el,
      config,
      createSlider,
      slide: () => createSlideElement({ num: slider.slideCount + 1 }, slider.slideCount + 1),
    });
    if (created) slider = created;
    readout("last").textContent = action.label;
    render();
  });
  render();
}

/** Restarts the row's flash, even if the last one is still fading. */
function flash(row: HTMLElement): void {
  row.removeAttribute("data-flash");
  void row.offsetWidth;
  row.setAttribute("data-flash", "");
}

function eventsDemo(): void {
  const panel = getRequiredElementById("api-events-demo");
  const el = getRequiredElementById("api-events-slider");
  const config: SliderConfig = { loop: true, autoplayInterval: 2000 };

  // Listeners go on before createSlider, or aero:ready would fire unheard.
  for (const row of document.querySelectorAll<HTMLElement>("#api-events [data-event]")) {
    const name = row.dataset.event as SliderEvent;
    const count = row.querySelector<HTMLElement>("[data-count]")!;
    const detail = row.querySelector<HTMLElement>("[data-detail]")!;
    let fired = 0;
    el.addEventListener(`aero:${name}`, (event) => {
      fired += 1;
      count.textContent = String(fired);
      detail.textContent = JSON.stringify((event as CustomEvent).detail);
      row.setAttribute("data-fired", "");
      flash(row);
    });
  }

  let slider = createSlider(el, config);
  const live = () => el.aeroSlider === slider;

  const autoplay = panel.querySelector<HTMLInputElement>('input[name="autoplay"]')!;
  autoplay.addEventListener("change", () => {
    config.autoplay = autoplay.checked;
    if (live()) slider.update({ autoplay: config.autoplay });
  });

  const perView = [...panel.querySelectorAll<HTMLButtonElement>("button[data-per-view]")];
  for (const button of perView) {
    button.addEventListener("click", () => {
      el.style.setProperty("--slides-per-view", button.dataset.perView!);
      for (const other of perView) other.toggleAttribute("data-active", other === button);
    });
  }

  const lifecycle = panel.querySelector<HTMLButtonElement>("button[data-lifecycle]")!;
  lifecycle.addEventListener("click", () => {
    if (live()) slider.destroy();
    else slider = createSlider(el, config);
    lifecycle.textContent = live() ? "slider.destroy()" : "slider = createSlider(el, config)";
  });
}

// Deferred so the playground paints first.
requestAnimationFrame(() => {
  controlDemo();
  eventsDemo();
});
