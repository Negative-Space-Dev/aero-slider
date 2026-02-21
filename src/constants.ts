import type { SliderConfig, SliderLayoutConfig } from "./types.ts";

export const DEFAULTS: Required<SliderConfig> = {
  loop: false,
  autoplay: false,
  autoplayInterval: 5000,
  draggable: true,
};

export const LAYOUT_DEFAULTS: SliderLayoutConfig = {
  slidesPerView: 1,
  gap: 0,
  aspectRatio: "16 / 9",
};

export const VELOCITY_SMOOTHING = 0.3;
export const MOMENTUM_FACTOR = 80;
export const SCROLL_END_DELAY = 150;
export const WHEEL_IDLE_MS = 300;
export const RESIZE_DEBOUNCE_MS = 100;
export const RESIZE_MAX_WAIT_MS = 250;

export const SLIDE_INDEX_ATTR = "data-aero-slider-index";
export const LOOP_CLONE_ATTR = "data-aero-slider-clone";
