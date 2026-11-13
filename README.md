# Aero Slider

A lightweight (under 9 KB of JavaScript and about 1 KB of CSS, gzipped), CSS-first slider library for the modern web.

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

## Working with AI agents

[aeroslider.md](aeroslider.md) is a compact guide for coding agents: the markup to write, the CSS variables, options, instance, events, how to extend the slider and the accessibility split. Point your agent at `node_modules/aero-slider/aeroslider.md` or at [aeroslider.com/aeroslider.md](https://aeroslider.com/aeroslider.md). It is also in every release zip, next to the JavaScript and CSS.

## Accessibility

Roles, names and controls belong in your markup. The slider adds only what changes at runtime.

The slider does this:

- Makes the container the one tab stop. Arrow keys, Home and End move the slider while the container, a nav button or a dot has focus. Keys pressed inside slide content stay with that content.
- Marks the current dot, and the current thumbnail of a synced strip, with `aria-current="true"`.
- Hides loop clones from screen readers, the tab order and forms.
- Keeps keyboard focus when a nav button disables or the dots are rebuilt, and brings a partly shown slide into view when focus moves into it.
- Announces the new position ("2 of 5") in a hidden live region when a user changes slide. It stays quiet for the moves autoplay makes on its own. Set `data-aero-status="Bild {index} von {count}"` on the container to word it for another language.

You write this:

```html
<div
  class="aero-slider"
  role="region"
  aria-roledescription="carousel"
  aria-label="Featured products"
>
  <div class="aero-slider__viewport">
    <button type="button" class="aero-slider__nav--prev" aria-label="Previous slide"></button>
    <button type="button" class="aero-slider__nav--next" aria-label="Next slide"></button>
    <div class="aero-slider__track">
      <div class="aero-slider__slides">
        <div role="group" aria-roledescription="slide" aria-label="1 of 3">…</div>
        <div role="group" aria-roledescription="slide" aria-label="2 of 3">…</div>
        <div role="group" aria-roledescription="slide" aria-label="3 of 3">…</div>
      </div>
    </div>
  </div>
  <div class="aero-slider__pagination" role="group" aria-label="Slides">
    <button type="button" class="aero-slider__dot" aria-label="Go to slide {index}"></button>
  </div>
</div>
```

- **Dots.** The one dot in the markup is a template. Make it a `<button type="button">`: a `<span>` is not reachable by keyboard. `{index}` in its `aria-label` becomes each dot's slide number.
- **Thumbnails.** Make each thumbnail of a synced strip a `<button type="button">` with its own name.
- **Autoplay.** Anything that moves for more than five seconds needs a pause control. Wire your own button to `pause()` and `resume()`:

```js
const slider = createSlider(el, { autoplay: true });
let paused = false;
toggle.addEventListener("click", () => {
  paused = !paused;
  slider[paused ? "pause" : "resume"]();
  toggle.setAttribute("aria-pressed", String(paused));
});
```

Text inside a slide can't be selected while a mouse drag would move the slider; list it in `noDrag` (for example `noDrag: "p, h2"`) to keep it selectable. `noDrag` defaults to `"input, textarea, select, [contenteditable]"`, and your value replaces it. Video and audio with native controls are safe to drag, because browsers keep a press on the control bar inside their own controls. Firefox does not let a mouse drag a video with `controls` at all.

## TypeScript

Types ship with the package. Slider events are typed on every `HTMLElement`, so listeners need no cast:

```ts
import { createSlider, type SliderEventMap } from "aero-slider";

createSlider(el);
el.addEventListener("aero:slideChange", (e) => console.log(e.detail.index));

type SlideChange = SliderEventMap["slideChange"]; // { index: number }
```

## Upgrading from 1.0

1.1 adds a required element. Wrap the slides in `.aero-slider__slides`, inside the track:

```html
<div class="aero-slider__track">
  <div class="aero-slider__slides">
    <div>…</div>
    <div>…</div>
  </div>
</div>
```

The track still scrolls. The new row is as long as its slides and the gaps between them, which lets the slider see a slide or a gap change size and measure again on its own.

- **Selectors.** `.aero-slider__track > *` no longer matches a slide. Use `.aero-slider__slides > *`, and move any `gap` you set on the track to the row (or set `--aero-slide-gap`).
- **Scripts that add or remove slides** change the children of `.aero-slider__slides`, then call `slider.refresh()`.
- **Slide sizes.** Slides are sized with `width` in `cqi` units against the track. A percentage width on a slide no longer works: use a length or `cqi`. A `flex-basis` of your own still wins over the default width.
- **Vertical sliders** need a viewport height that does not come from the slides. The default takes it from `--aero-slide-aspect`.
- **`noDrag`** no longer lists `audio[controls]` and `video[controls]`. Add them back if a press on a video must not drag.

## Upgrading from a beta

1.0 renamed these, and the old names no longer work. Rename them in your options, markup and CSS:

| Beta                 | 1.0                      |
| -------------------- | ------------------------ |
| `alignment: "left"`  | `alignment: "start"`     |
| `alignment: "right"` | `alignment: "end"`       |
| `--slides-per-view`  | `--aero-slides-per-view` |
| `--slide-gap`        | `--aero-slide-gap`       |
| `--slide-aspect`     | `--aero-slide-aspect`    |

The betas also had these, which 1.0 removes:

| Beta                              | 1.0                                                                         |
| --------------------------------- | --------------------------------------------------------------------------- |
| `slider.add()`, `slider.remove()` | Change the children of `.aero-slider__slides`, then call `slider.refresh()` |
| `direction: "ttb"`                | `vertical: true`                                                            |
| `direction: "rtl"`                | `dir="rtl"` on the slider or any ancestor                                   |
| `labels`                          | Write the names in your markup                                              |

More things to check:

- **Roles and names are yours now.** The betas wrote the roles and labels for the container, slides, arrows and dots. 1.0 leaves them to your markup, so add them as [Accessibility](#accessibility) shows. Without them the slider still works, but screen readers get unnamed controls.
- **Finding slides in a looping slider.** A looping slider also holds copies of its slides. Select a real slide with `[data-aero-slider-index="2"]`, not by its place among the children of `.aero-slider__slides`.
- **Alignment is logical.** `"start"` is the right edge in an RTL slider and the top in a vertical one.
- **Your own selectors on `data-aero-alignment`.** The attribute now holds `"start"`, `"center"` or `"end"`, so a rule such as `[data-aero-alignment="left"]` no longer matches.
- **Nested sliders.** The `--aero-*` variables are inherited, so you can set them on any ancestor of a slider. The exception is `--aero-layout-width`, which goes on the slider itself. They stop at the content of a slide: a slider nested inside a slide, or used as a slide itself, does not take the outer slider's settings, so set its variables on the nested slider itself.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, working on the doc site, and publishing.
