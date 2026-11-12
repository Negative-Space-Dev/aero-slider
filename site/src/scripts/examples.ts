import { createSlider, syncThumbnails } from "aero-slider";
import type { SliderConfig, SliderInstance } from "aero-slider";
import { examples, type DemoSlider } from "../data/examples";
import { getRequiredElementById } from "../lib/dom";

const sliders = Object.values(examples).flatMap((example) => example.sliders);
const instances = new Map<string, SliderInstance>();

function start(slider: DemoSlider): SliderInstance {
  const instance = createSlider(getRequiredElementById(slider.id), slider.config);
  instances.set(slider.id, instance);
  return instance;
}

const instance = (id: string) => instances.get(id)!;

function wireEdgeToEdge(): void {
  const group = getRequiredElementById("edge-align");
  group.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-align]");
    const alignment = button?.dataset.align as SliderConfig["alignment"] | undefined;
    if (!alignment) return;
    instance("edge-to-edge").update({ alignment });
    for (const each of group.querySelectorAll<HTMLButtonElement>("button[data-align]")) {
      each.toggleAttribute("data-active", each === button);
    }
  });
}

const REPLAY_PAUSE_MS = 900;

/** Puts both sliders back to their server-rendered state, holds it, then starts them again. */
function wireNoShiftReplay(): void {
  const button = getRequiredElementById<HTMLButtonElement>("no-shift-replay");
  const pair = examples["ex-no-shift"].sliders;
  button.addEventListener("click", () => {
    button.disabled = true;
    for (const slider of pair) {
      instance(slider.id).destroy();
      const el = getRequiredElementById(slider.id);
      for (const [name, value] of Object.entries(slider.attrs ?? {})) el.setAttribute(name, value);
      el.querySelector<HTMLElement>(".aero-slider__track")!.scrollLeft = 0;
    }
    setTimeout(() => {
      for (const slider of pair) start(slider);
      button.disabled = false;
    }, REPLAY_PAUSE_MS);
  });
}

function wireNoDragButtons(): void {
  const el = getRequiredElementById("no-drag");
  el.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-label]");
    if (!button) return;
    button.textContent = "Done";
    setTimeout(() => (button.textContent = button.dataset.label!), 1200);
  });
}

// Deferred so the playground paints first.
requestAnimationFrame(() => {
  for (const slider of sliders) start(slider);
  syncThumbnails(instance("gallery"), instance("gallery-thumbs"));
  wireEdgeToEdge();
  wireNoShiftReplay();
  wireNoDragButtons();
});
