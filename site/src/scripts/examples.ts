import { createSlider, syncThumbnails } from "aero-slider";
import type { SliderConfig, SliderInstance } from "aero-slider";
import { examples, type DemoSlider } from "../data/examples";
import { getRequiredElementById } from "../lib/dom";
import { nameSlides } from "../lib/slide";

// Each wire function below runs the steps its example prints in the JS tab.

const sliders = Object.values(examples).flatMap((example) => example.sliders);
const instances = new Map<string, SliderInstance>();

function start(slider: DemoSlider): SliderInstance {
  const instance = createSlider(getRequiredElementById(slider.id), slider.config);
  instances.set(slider.id, instance);
  return instance;
}

const instance = (id: string) => instances.get(id)!;

/** Marks the pressed button of a segmented control and returns it. */
function pick(group: HTMLElement, event: Event, attr: string): HTMLButtonElement | null {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(`button[${attr}]`);
  if (!button) return null;
  for (const each of group.querySelectorAll<HTMLButtonElement>(`button[${attr}]`)) {
    each.toggleAttribute("data-active", each === button);
  }
  return button;
}

function wireProductRow(): void {
  const slider = instance("product-row");
  const el = slider.element;
  let perMove = 1;
  function pageSize(): void {
    const fit = Math.floor(
      parseFloat(getComputedStyle(el).getPropertyValue("--aero-slides-per-view"))
    );
    if (fit !== perMove) slider.update({ perMove: (perMove = fit) });
  }
  el.addEventListener("aero:resized", pageSize);
  pageSize();

  // The cards' links and buttons go nowhere on this page; show that the click arrived.
  el.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-demo-link]")) event.preventDefault();
    const button = target.closest<HTMLButtonElement>("button[data-label]");
    if (!button) return;
    button.textContent = "Added";
    setTimeout(() => (button.textContent = button.dataset.label!), 1200);
  });
}

function wireEdgeToEdge(): void {
  const group = getRequiredElementById("edge-align");
  group.addEventListener("click", (event) => {
    const alignment = pick(group, event, "data-align")?.dataset.align;
    if (alignment) {
      instance("edge-to-edge").update({ alignment: alignment as SliderConfig["alignment"] });
    }
  });
}

function wireMobileOnly(): void {
  const el = getRequiredElementById("collections");
  const phone = matchMedia("(max-width: 767px)");
  let slider: SliderInstance | undefined;
  function sync(): void {
    if (phone.matches) {
      slider ??= createSlider(el);
    } else {
      slider?.destroy();
      slider = undefined;
    }
  }
  phone.addEventListener("change", sync);
  sync();
}

function wireVariants(): void {
  const main = instance("variant-gallery");
  const thumbs = instance("variant-thumbs");
  syncThumbnails(main, thumbs);

  const galleries = [main, thumbs].map((slider) => ({
    slider,
    track: slider.element.querySelector<HTMLElement>(".aero-slider__track")!,
    slides: [...slider.element.querySelectorAll<HTMLElement>("[data-aero-slider-index]")],
  }));

  // The switch beside the swatches: start each colour from its first image, or stay put.
  let toFirst = true;
  function show(variant: string): void {
    for (const { slider, track, slides } of galleries) {
      track.replaceChildren(
        ...slides.filter((slide) => (slide.dataset.variant ?? variant) === variant)
      );
      nameSlides(track);
      slider.refresh();
    }
    if (toFirst) main.goTo(0, { instant: true });
  }

  const swatches = getRequiredElementById("swatches");
  const rest = getRequiredElementById("variant-rest");
  rest.addEventListener("click", (event) => {
    const choice = pick(rest, event, "data-rest")?.dataset.rest;
    if (choice) toFirst = choice === "first";
  });
  show("graphite");
  swatches.addEventListener("click", (event) => {
    const variant = pick(swatches, event, "data-variant")?.dataset.variant;
    if (variant) show(variant);
  });
}

function wireCounter(): void {
  const slider = instance("counted");
  const count = getRequiredElementById("gallery-count");
  const bar = getRequiredElementById("gallery-bar");
  function show(): void {
    const position = slider.currentIndex + 1;
    count.textContent = `${position} / ${slider.slideCount}`;
    bar.style.width = `${(position / slider.slideCount) * 100}%`;
  }
  slider.element.addEventListener("aero:slideChange", show);
  show();
}

// Deferred so the playground paints first.
requestAnimationFrame(() => {
  for (const slider of sliders) if (!slider.manual) start(slider);
  syncThumbnails(instance("gallery"), instance("gallery-thumbs"));
  wireProductRow();
  wireEdgeToEdge();
  wireMobileOnly();
  wireVariants();
  wireCounter();
});
