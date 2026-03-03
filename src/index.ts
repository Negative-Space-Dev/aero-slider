import { createSlider } from "./slider.ts";
import { syncThumbnails } from "./sync.ts";

export { createSlider, syncThumbnails };
export type { SyncThumbnailsOptions } from "./sync.ts";
export type {
  SliderConfig,
  SliderInstance,
  SliderEvent,
  SliderEventData,
} from "./types.ts";

declare global {
  interface Window {
    AeroSlider?: { createSlider: typeof createSlider; syncThumbnails: typeof syncThumbnails };
  }
}

if (typeof window !== "undefined") {
  window.AeroSlider = { createSlider, syncThumbnails };
}
