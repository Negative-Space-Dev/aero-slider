# Working with aero-slider

Guidance for coding agents that add or edit an aero-slider. The library is CSS-first: layout lives in CSS variables and markup, and the JavaScript only handles events, loop clones, pagination and autoplay. Roles, names and controls are yours to write in the markup. The slider does not add them.

## Setup

```js
import { createSlider, syncThumbnails } from "aero-slider";
import "aero-slider/slider.css";

const slider = createSlider(element, { loop: true });
```

Without a bundler, load `dist/aero-slider.min.js` with `type="module"` and use `window.AeroSlider.createSlider`. Importing `aero-slider` through a bundler sets no global.

## Markup

Write all of this. Class names are fixed.

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

- Every direct child of `.aero-slider__track` is a slide. Nav buttons and pagination are optional.
- Give the container a name with `aria-label` or `aria-labelledby`.
- Write one `.aero-slider__dot` as a template. The slider copies it once per stop and replaces `{index}` in its `aria-label`. Use `<button type="button">`. A `<span>` dot cannot be reached by keyboard.
- A slide that is a link, a list item or an image keeps its own semantics. Do not add `role="group"` to it.
- With `loop`, add `data-aero-defer-visibility` to the container to reserve the clones' space before init. If the alignment is not centred, also set `data-aero-alignment="start"` or `"end"` in the HTML.

## Layout: CSS variables

Set these on the slider or any ancestor, and change them in media or container queries. Do not size slides in JavaScript.

| Variable                 | Default | Meaning                                                                         |
| ------------------------ | ------- | ------------------------------------------------------------------------------- |
| `--aero-slides-per-view` | `1`     | Slides in view. Fractions such as `1.5` show a peek.                            |
| `--aero-slide-gap`       | `0px`   | Space between slides.                                                           |
| `--aero-slide-aspect`    | `5 / 3` | Aspect ratio of each slide.                                                     |
| `--aero-layout-width`    | `100%`  | Content column width, used with `aero-slider--breakout` for a full-bleed track. |

- The variables stop at a slide's content. Set them on a nested slider itself.
- After changing a variable from script, call `slider.refresh()`. A resize re-measures on its own.
- The pre-1.0 names (`--slides-per-view`, `--slide-gap`, `--slide-aspect`) still work. Use the new names.

## Options

| Option             | Default        | Notes                                                                                             |
| ------------------ | -------------- | ------------------------------------------------------------------------------------------------- |
| `loop`             | `false`        | Turns itself off when every slide already fits in view.                                           |
| `autoplay`         | `false`        | `true` moves every `autoplayInterval` ms. `"continuous"` drifts like a ticker and implies `loop`. |
| `autoplayInterval` | `5000`         | Milliseconds, at least 100.                                                                       |
| `autoplaySpeed`    | `40`           | Pixels per second for `"continuous"`.                                                             |
| `draggable`        | `true`         | Mouse drag. Touch always scrolls natively.                                                        |
| `alignment`        | `"center"`     | `"start"`, `"center"` or `"end"`. Logical, so `"start"` is the right edge in RTL.                 |
| `maxDots`          | `0`            | Show at most this many dots, windowed. `0` shows all.                                             |
| `noDrag`           | `""`           | Selector for content that must not start a drag, such as `"p, h2"` to keep text selectable.       |
| `perMove`          | `1`            | Stops advanced by `next()` and `prev()`.                                                          |
| `direction`        | `"auto"`       | Follows the page's direction. `"ltr"` and `"rtl"` force one. `"ttb"` is vertical.                 |
| `snap`             | `"native"`     | `"settle"` scrolls freely then eases onto a slide. `"none"` rests anywhere.                       |
| `scrollDuration`   | `0`            | Milliseconds for scripted moves. `0` uses native smooth scrolling.                                |
| `scrollEasing`     | ease-out cubic | `(progress) => eased`, used with `scrollDuration`.                                                |

## Instance

`currentIndex`, `slideCount`, `element`, `next()`, `prev()`, `goTo(index, { instant })`, `pause()`, `resume()`, `update(config)`, `refresh()`, `add(slides, index?)`, `remove(index)`, `destroy()`. The instance is also at `element.aeroSlider`.

- Add and remove slides with `add()` and `remove()`, or change the DOM and call `refresh()`.
- Without `loop`, slides that rest at the same position near an end share one stop and one dot. `goTo()` and `currentIndex` still use slide indexes.
- Calling `createSlider` again on the same element replaces the old instance. `destroy()` restores the markup.

## Events

DOM `CustomEvent`s on the container, typed in TypeScript: `aero:ready`, `aero:slideChange` (`detail.index`), `aero:dragStart`, `aero:dragEnd`, `aero:autoplayStart`, `aero:autoplayStop`, `aero:resize`, `aero:resized`, `aero:visible` and `aero:hidden` (`detail.index`), `aero:destroy`.

```js
element.addEventListener("aero:slideChange", (event) => console.log(event.detail.index));
```

They bubble. Inside a nested setup, check `event.target === element`.

## Thumbnails

```js
const teardown = syncThumbnails(mainSlider, thumbSlider, { loop: false });
```

Make each thumbnail a `<button type="button">` with its own name. The slider marks the current one with `aria-current="true"` and the class `aero-slider__thumb--active`.

## Accessibility

The slider handles what changes at runtime:

- The container is the one tab stop. Arrow keys, Home and End move the slider while the container, a nav button or a dot has focus.
- The current dot and thumbnail carry `aria-current="true"`.
- Loop clones are hidden from screen readers, the tab order and forms.
- Focus is kept when a nav button disables or the dots are rebuilt, and focus moving into a partly shown slide brings it into view.
- A hidden live region announces the position when a user changes slide. Word it with `data-aero-status="Slide {index} of {count}"` on the container.

You write the rest:

- The region role, role description and name on the container, and the group role and name on each slide, as in the markup above. Update the slide names if the slide count changes.
- Names on the nav buttons, the dot template and the thumbnails.
- A pause control for any autoplay that runs longer than five seconds:

```js
let paused = false;
toggle.addEventListener("click", () => {
  paused = !paused;
  slider[paused ? "pause" : "resume"]();
  toggle.setAttribute("aria-pressed", String(paused));
});
```

Autoplay already pauses on hover, on keyboard focus inside, during a drag and while the tab is hidden, and never runs under `prefers-reduced-motion`.

## Styling hooks

- State classes on the container: `aero-slider--ready`, `aero-slider--dragging`, `aero-slider--draggable`, `aero-slider--vertical`, `aero-slider--free`.
- Dots: `aero-slider__dot--active`, and with `maxDots`, `aero-slider__dot--edge`, `--near-edge` and `--hidden`.
- Nav buttons are disabled at the ends of a slider without `loop`. Style `:disabled`.
- The slider sets `data-aero-alignment` to `"start"`, `"center"` or `"end"` after init.

## Mistakes to avoid

- Setting slide widths, gaps or counts in JavaScript, or passing them as options. They are CSS variables.
- Leaving out `aero-slider/slider.css`. Nothing lays out without it.
- Using `<span>` dots or `<div>` thumbnails, which a keyboard cannot reach.
- Expecting the slider to add roles, labels or a pause button.
- Selecting `[data-aero-alignment="left"]` in CSS. The slider writes `"start"`.
- Creating the slider before its slides are in the DOM without calling `refresh()` afterwards.
