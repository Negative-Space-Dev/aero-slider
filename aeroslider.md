# aero-slider agent guide

**Model.** The track is a native CSS scroll container. CSS variables set the layout. JavaScript adds only behaviour: navigation, loop clones, dots, autoplay, drag, events. You write the markup, the look and the accessibility names. The library ships no styles for arrows or dots.

## Install

```js
import { createSlider, syncThumbnails } from "aero-slider";
import "aero-slider/slider.css"; // required: nothing lays out without it

const slider = createSlider(element, { loop: true });
```

No bundler: load `dist/aero-slider.min.css` and `dist/aero-slider.min.js` (`type="module"`), then call `window.AeroSlider.createSlider`. The package import sets no global.

`createSlider` throws if the container has no `.aero-slider__track` or the track has no children. Bad option values never throw; they fall back to defaults.

## Markup

Class names are fixed. Roles and names are yours to write; the slider does not add them.

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
      <div role="group" aria-roledescription="slide" aria-label="1 of 3">…</div>
      <div role="group" aria-roledescription="slide" aria-label="2 of 3">…</div>
      <div role="group" aria-roledescription="slide" aria-label="3 of 3">…</div>
    </div>
  </div>
  <div class="aero-slider__pagination" role="group" aria-label="Slides">
    <button type="button" class="aero-slider__dot" aria-label="Go to slide {index}"></button>
  </div>
</div>
```

| Part                                             | Required | Notes                                                                                                                  |
| ------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `.aero-slider`                                   | yes      | Container. Receives events, state classes and the instance (`element.aeroSlider`).                                     |
| `.aero-slider__viewport`                         | yes      | `position: relative`. Put arrows inside it, before the track.                                                          |
| `.aero-slider__track`                            | yes      | The scroller. Every direct child is a slide.                                                                           |
| `.aero-slider__nav--prev`, `--next`              | no       | Buttons. Disabled by the slider at an end it cannot pass. Never disabled with `loop`.                                  |
| `.aero-slider__pagination` > `.aero-slider__dot` | no       | One dot as a template. Copied once per stop; `{index}` in its `aria-label` becomes the slide number. Use a `<button>`. |

- A slide that is a link, list item or image keeps its own semantics. Do not add `role="group"` to it.
- Real slides carry `data-aero-slider-index`. Loop clones carry `data-aero-slider-clone`. Select real slides with `.aero-slider__track > [data-aero-slider-index]`, never all track children.

## Layout

CSS variables on the slider or any ancestor, except `--aero-layout-width`, which goes on the slider itself. Change them in media or container queries. Never size slides in JavaScript.

| Variable                 | Default | Meaning                                        |
| ------------------------ | ------- | ---------------------------------------------- |
| `--aero-slides-per-view` | `1`     | Slides in view, 1 or more. `1.5` shows a peek. |
| `--aero-slide-gap`       | `0px`   | Space between slides.                          |
| `--aero-slide-aspect`    | `5 / 3` | Aspect ratio of each slide.                    |
| `--aero-layout-width`    | `100%`  | Content column width, for a breakout slider.   |

```css
.products {
  --aero-slides-per-view: 1.2;
  --aero-slide-gap: 12px;
}
@media (min-width: 768px) {
  .products {
    --aero-slides-per-view: 3;
  }
}
```

- Resizes re-measure on their own, and so does any slide that changes size (an image loads, a font swaps in). After changing a variable from script, call `slider.refresh()`: a new gap between fixed-width slides resizes nothing, so the slider cannot see it.
- The variables stop at a slide's content. Set them again on a nested slider.
- Breakout (track runs off both window edges, active slide lines up with the content column): add `aero-slider--breakout`, make the container full-bleed, set `--aero-layout-width` on the slider to the column width.
- With `loop`, add `data-aero-defer-visibility` to the container to avoid a layout shift before init. If alignment is not centred, also write `data-aero-alignment="start"` or `"end"` in the HTML.

## Options

`createSlider(element, options)`; change later with `slider.update(options)`.

| Option             | Default        | Notes                                                                                               |
| ------------------ | -------------- | --------------------------------------------------------------------------------------------------- |
| `loop`             | `false`        | Turns itself off when every slide already fits in view.                                             |
| `alignment`        | `"center"`     | `"start"`, `"center"`, `"end"`. Logical: `"start"` is the right edge in RTL, the top when vertical. |
| `vertical`         | `false`        | Scrolls top to bottom, ignoring `dir`. Horizontal sliders follow `dir`; `refresh()` if it changes.  |
| `perMove`          | `1`            | Stops advanced by `next()`, `prev()`, the arrows, the arrow keys and autoplay.                      |
| `snap`             | `"native"`     | `"settle"` scrolls freely, then eases onto a slide. `"none"` rests anywhere.                        |
| `draggable`        | `true`         | Mouse drag. Touch always scrolls natively.                                                          |
| `noDrag`           | form fields    | Selector for slide content that must not start a drag. Replaces the default, listed below.          |
| `autoplay`         | `false`        | `true` steps every `autoplayInterval`. `"continuous"` drifts like a ticker and implies `loop`.      |
|                    |                | `"continuous"` also forces `snap: "none"`, whatever `snap` is set to.                               |
| `autoplayInterval` | `5000`         | Milliseconds, at least 100.                                                                         |
| `autoplaySpeed`    | `40`           | Pixels per second for `"continuous"`.                                                               |
| `maxDots`          | `0`            | Show at most this many dots, windowed. `0` shows all.                                               |
| `scrollDuration`   | `0`            | Milliseconds for scripted moves. `0` uses native smooth scrolling.                                  |
| `scrollEasing`     | ease-out cubic | `(progress) => eased`, used with `scrollDuration`.                                                  |

`noDrag` defaults to `"input, textarea, select, [contenteditable], audio[controls], video[controls]"`: controls that are dragged themselves. Links and buttons are left out, so a slide that is a link still drags. Add them if a slide's links must never start a drag.

Autoplay pauses on hover, on keyboard focus inside, during a press or drag and while the tab is hidden. It never runs under `prefers-reduced-motion`.

## Instance

| Member                                  | Use                                                            |
| --------------------------------------- | -------------------------------------------------------------- |
| `currentIndex`, `slideCount`, `element` | Read-only state.                                               |
| `next()`, `prev()`                      | Move by `perMove`.                                             |
| `goTo(index, { instant })`              | Go to a slide index. `instant: true` skips the animation.      |
| `pause()`, `resume()`                   | Hold and release autoplay from code.                           |
| `update(options)`                       | Change options in place.                                       |
| `refresh()`                             | Rebuild after you change the track's slides or a CSS variable. |
| `destroy()`                             | Remove listeners and clones and restore the markup.            |

- Without `loop`, slides that rest at the same position near an end share one stop and one dot. Indexes are still slide indexes.
- Calling `createSlider` again on the same element replaces the old instance.

## Events

`CustomEvent`s on the container, typed in TypeScript. They bubble: with nested sliders, check `event.target === element`.

| Event                                     | `detail`               | When                                          |
| ----------------------------------------- | ---------------------- | --------------------------------------------- |
| `aero:ready`                              | `{}`                   | Initialised.                                  |
| `aero:slideChange`                        | `{ index }`            | The current slide changed.                    |
| `aero:visible`, `aero:hidden`             | `{ index }`            | A slide entered or left the viewport.         |
| `aero:dragStart`                          | `{ index }`            | A mouse drag began.                           |
| `aero:dragEnd`                            | `{ index, fromIndex }` | A mouse drag ended.                           |
| `aero:autoplayStart`, `aero:autoplayStop` | `{}`                   | Autoplay started or stopped, pauses included. |
| `aero:resize`, `aero:resized`             | `{}`                   | Before and after a re-measure.                |
| `aero:destroy`                            | `{}`                   | Destroyed.                                    |

## Extending

Build on the instance and the events. Do not patch the library or move the track's scroll position yourself.

- **Custom controls** (any element, anywhere): call `next()`, `prev()` or `goTo(i)` from your own handlers.
- **Derived UI** (counter, progress bar, caption, analytics): listen for `aero:slideChange` and read `detail.index` and `slider.slideCount`.
- **Work per visible slide** (play a video, load data, animate in): use `aero:visible` and `aero:hidden`.
- **Dynamic content**: edit the track's children and call `refresh()`. It rests on the same index; follow with `goTo(0, { instant: true })` to start over. To swap the whole set (variant images): `track.replaceChildren(...slides); slider.refresh()`. A slide hidden with CSS still counts, so remove it from the track. A looping track also holds clones (`data-aero-slider-clone`); find a slide by `[data-aero-slider-index="N"]`, not by child position. Rewrite the slide names ("2 of 5") when the count changes.
- **Frameworks**: create the slider once the slides are in the DOM (mount effect) and call `destroy()` on unmount. After the framework re-renders the slides, call `refresh()`.
- **Thumbnails**: two sliders and `syncThumbnails`.

```js
const main = createSlider(mainEl);
const thumbs = createSlider(thumbsEl, { alignment: "center" });
const teardown = syncThumbnails(main, thumbs, { loop: false }); // strip loops by default
// later: teardown(); main.destroy(); thumbs.destroy();
```

Both need the same number of slides. Make each thumbnail a `<button type="button">` with an `aria-label`. The current one gets `aero-slider__thumb--active` and `aria-current="true"`.

- **Pause control**, required for autoplay that runs longer than five seconds:

```js
let paused = false;
toggle.addEventListener("click", () => {
  paused = !paused;
  slider[paused ? "pause" : "resume"]();
  toggle.setAttribute("aria-pressed", String(paused));
});
```

## Accessibility

| The slider does                                                                                                    | You write                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Makes the container the one tab stop. Arrow keys, Home and End work from the container, a nav button or a dot.     | Region role, role description and name on the container.                                                                    |
| Sets `aria-current="true"` on the current dot and thumbnail.                                                       | Group role and name on each slide.                                                                                          |
| Hides loop clones from screen readers, the tab order and forms.                                                    | Names on nav buttons, the dot template and thumbnails.                                                                      |
| Keeps focus when a nav button disables or dots rebuild. Scrolls a partly shown slide into view when it gets focus. | `<button>` for dots and thumbnails.                                                                                         |
| Announces "2 of 5" in a hidden live region on a user change. Silent during autoplay.                               | A pause control for autoplay. `data-aero-status="Bild {index} von {count}"` on the container to translate the announcement. |

## Styling hooks

- Container: `aero-slider--ready`, `--draggable`, `--dragging`, `--vertical`, `--free` (snap is not native), and `data-aero-alignment="start" | "center" | "end"`.
- Slides: `aero-slider__slide` is added to each.
- Dots: `aero-slider__dot--active`. With `maxDots`: `--edge`, `--near-edge`, `--hidden`.
- Arrows: style `:disabled` for the end state.
- Thumbnails: `aero-slider__thumb--active`.

## Rules

- Layout is CSS variables. Do not pass sizes as options or set widths in JavaScript.
- Use `<button>` for dots and thumbnails. `<span>` and `<div>` cannot be reached by keyboard.
- Do not expect roles, labels or a pause button from the slider.
- Do not create the slider before its slides exist, unless you call `refresh()` afterwards.
- Do not read or write loop clones. Filter on `[data-aero-slider-index]`.
- Call `destroy()` before removing the element.
