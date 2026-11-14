import { autoplay, createSlider, loop, maxDots, syncThumbnails, use } from "./index.ts";

export * from "./index.ts";
import "./global-type.ts";

// The full file: every extension, ready to use.
use({ loop, autoplay, maxDots });
if (typeof window !== "undefined") {
  window.AeroSlider = { createSlider, use, syncThumbnails };
}
