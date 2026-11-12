// Compiled against dist/index.d.ts through the package's own exports, as a consumer sees it.
import { createSlider, type SliderEventMap } from "aero-slider";

const element = document.createElement("div");
const slider = createSlider(element, { loop: true });

element.addEventListener("aero:slideChange", (e) => {
  const index: number = e.detail.index;
  slider.goTo(index);
});
element.addEventListener("aero:dragEnd", (e) => e.detail.fromIndex);

const change: SliderEventMap["slideChange"] = { index: 0 };
const fromMap: SliderEventMap["dragEnd"]["fromIndex"] = change.index;

element.aeroSlider?.next();

// @ts-expect-error slideChange carries no fromIndex
element.addEventListener("aero:slideChange", (e) => e.detail.fromIndex);

// @ts-expect-error the bundler entry does not declare the CDN global
window.AeroSlider;

export { fromMap };
