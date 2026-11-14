import type { createSlider, use } from "./slider.ts";
import type { syncThumbnails } from "./sync.ts";

declare global {
  interface Window {
    AeroSlider?: {
      createSlider: typeof createSlider;
      use: typeof use;
      syncThumbnails?: typeof syncThumbnails;
    };
  }
}

export {};
