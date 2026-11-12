# Aero Slider

A lightweight (about 7 KB of JavaScript and 1 KB of CSS, gzipped), CSS-first slider library for the modern web.

- **CSS-First Architecture** — Layout via custom properties, responsive via media queries
- **Native Scroll Snapping** — Hardware-accelerated, smooth scrolling
- **Continuous Autoplay** — `autoplay: "continuous"` drifts the track like a ticker at `autoplaySpeed` px/s, seamlessly looped with no per-frame JavaScript
- **Snap Modes** — Native CSS snapping by default; `snap: "settle"` scrolls freely and eases onto the nearest slide, `snap: "none"` rests wherever it stops
- **Minimal JS Footprint** — Only handles events, loop cloning, pagination, autoplay
- **Zero Dependencies** — No external libraries required
- **Thumbnail Syncing** — Link primary sliders with thumbnail navigation
- **iOS-Style Pagination** — Optional `maxDots` for windowed dot navigation

**Documentation:** [aeroslider.com](https://aeroslider.com)

## Installation

### Package manager (recommended)

```bash
bun add aero-slider
```

Or with npm:

```bash
npm install aero-slider
```

Then import the package and styles:

```js
import { createSlider } from "aero-slider";
import "aero-slider/slider.css";
```

### Global script (no bundler)

Add the JavaScript and CSS files. `dist/aero-slider.min.js` sets `window.AeroSlider`; load it with `type="module"`:

```html
<link rel="stylesheet" href="https://unpkg.com/aero-slider/dist/aero-slider.min.css" />
<script type="module" src="https://unpkg.com/aero-slider/dist/aero-slider.min.js"></script>
```

Or download from the [releases](https://github.com/Negative-Space-Dev/aero-slider/releases) page. This creates a global `AeroSlider` object:

```js
const slider = AeroSlider.createSlider(document.getElementById("my-slider"), { loop: true });

// With thumbnails:
const main = AeroSlider.createSlider(mainEl);
const thumbs = AeroSlider.createSlider(thumbsEl);
const teardown = AeroSlider.syncThumbnails(main, thumbs);
```

The bundler entry (`import ... from "aero-slider"`) sets no global, so bundlers can drop what you don't import.

## TypeScript

Types ship with the package. Slider events are typed on every `HTMLElement`, so listeners need no cast:

```ts
import { createSlider, type SliderEventMap } from "aero-slider";

createSlider(el);
el.addEventListener("aero:slideChange", (e) => console.log(e.detail.index));

type SlideChange = SliderEventMap["slideChange"]; // { index: number }
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, working on the doc site, and publishing.
