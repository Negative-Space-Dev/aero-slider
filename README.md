# Aero Slider

A lightweight (about 9 KB of JavaScript and 1 KB of CSS, gzipped), CSS-first slider library for the modern web.

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

## Accessibility

By default the container is a carousel region and the slider's one tab stop. Arrow keys, Home and End move it while the container, its nav buttons or its dots have focus. Keys pressed inside slide content stay with that content. Each slide is a group named by its position ("2 of 5"). Dots are a group of buttons with the current one marked, and loop clones are hidden from screen readers and the tab order. A hidden status line announces the new position politely when a user changes slide, and stays quiet while autoplay runs. Keyboard focus in a slide that is only partly shown brings it into view.

You provide:

- A name for the slider: `aria-label` or `aria-labelledby` on the container.
- A label on each nav button, such as `aria-label="Previous slide"`.
- A pause button whenever autoplay runs for more than five seconds. Add a `<button type="button" class="aero-slider__autoplay">` inside the container. The slider names it by what a press will do, or keeps `aria-pressed` in step if it has its own name. It hides it while autoplay is off or the visitor prefers reduced motion, and adds `aero-slider--paused` to the container while it is paused.

Use a `<button type="button">` as the dot template, so a slider inside a form never submits it. A `<span>` still works, and the slider makes it a keyboard button:

```html
<div class="aero-slider__pagination">
  <button type="button" class="aero-slider__dot"></button>
</div>
```

The slider writes English strings. Pass `labels` to translate them; `{index}` and `{count}` are filled in:

```js
createSlider(el, {
  labels: { carousel: "Karussell", slide: "Folie", slidePosition: "{index} von {count}" },
});
```

The slider never replaces a role, label or `tabindex` you set yourself. Text inside a slide can't be selected while a mouse drag would move the slider; list it in `noDrag` (for example `noDrag: "p, h2"`) to keep it selectable.

## TypeScript

Types ship with the package. Slider events are typed on every `HTMLElement`, so listeners need no cast:

```ts
import { createSlider, type SliderEventMap } from "aero-slider";

createSlider(el);
el.addEventListener("aero:slideChange", (e) => console.log(e.detail.index));

type SlideChange = SliderEventMap["slideChange"]; // { index: number }
```

## Renamed in 1.0

The old names still work as aliases, so existing options, markup and variables keep working:

| Old                  | New                      |
| -------------------- | ------------------------ |
| `alignment: "left"`  | `alignment: "start"`     |
| `alignment: "right"` | `alignment: "end"`       |
| `--slides-per-view`  | `--aero-slides-per-view` |
| `--slide-gap`        | `--aero-slide-gap`       |
| `--slide-aspect`     | `--aero-slide-aspect`    |

Alignment is logical: `"start"` is the right edge in an RTL slider and the top in a vertical one. When both a new and an old variable are set on the same element, the new one wins.

Two things to check when you upgrade:

- **Your own selectors on `data-aero-alignment`.** The library writes `data-aero-alignment="start"` or `"end"` once it initialises, whichever spelling you used. The stylesheet accepts `"left"` and `"right"` in server-rendered markup, but a rule of yours such as `[data-aero-alignment="left"]` stops matching after init. Select both spellings: `:is([data-aero-alignment="start"], [data-aero-alignment="left"])`.
- **Nested sliders.** The `--aero-*` variables are inherited, so you can set them on any ancestor of a slider. They stop at the content of a slide: a slider nested inside a slide, or used as a slide itself, does not take the outer slider's settings, so set its variables on the nested slider itself.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, working on the doc site, and publishing.
