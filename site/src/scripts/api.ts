import { createSlider } from "aero-slider";
import type { SliderConfig } from "aero-slider";
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

// Deferred so the playground paints first.
requestAnimationFrame(() => {
  controlDemo();
});
