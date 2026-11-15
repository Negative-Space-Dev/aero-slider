import { autoplay, createSlider, loop, scrollingDots, syncThumbnails, use } from "./index.ts";

export * from "./index.ts";
import "./global-type.ts";

// The full file: every extension, ready to use.
use({ loop, autoplay, scrollingDots });
if (typeof window !== "undefined") {
  window.AeroSlider = { createSlider, use, syncThumbnails };
}
