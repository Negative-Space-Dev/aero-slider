import { createSlider, syncThumbnails } from "./index.ts";

export * from "./index.ts";

declare global {
  interface Window {
    AeroSlider?: { createSlider: typeof createSlider; syncThumbnails: typeof syncThumbnails };
  }
}

if (typeof window !== "undefined") {
  window.AeroSlider = { createSlider, syncThumbnails };
}
