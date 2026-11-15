import { createSlider, use } from "../slider.ts";
import "../global-type.ts";

export { createSlider, use };

// The core file: extension files loaded after it register themselves here.
window.AeroSlider = { createSlider, use };
