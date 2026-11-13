// One definition per example. The Astro section renders the demo and its code
// tabs from it, and the client script starts the demo from the same `config`,
// so the code shown is the code that runs. No Astro imports: the client script
// bundles this module too.

import type { SliderConfig } from "aero-slider";
import type { CodeTab } from "../lib/code";
import { slideRole, thumbRole, type SlideContent } from "../lib/slide";
import { exampleIds, type ExampleId } from "./anchors";

export const exampleGroups = [
  { key: "layout", id: "examples-layout", title: "Layout" },
  { key: "motion", id: "examples-motion", title: "Motion" },
  { key: "controls", id: "examples-controls", title: "Controls" },
] as const;

export type ExampleGroup = (typeof exampleGroups)[number]["key"];

export type CssVars = Record<`--${string}`, string>;

/** What a demo slide shows. The code samples stand each one in as a plain `<div>`. */
export type DemoSlide =
  | ({
      kind?: "plate";
      /** The variant a slide belongs to; none means every variant. */ variant?: string;
    } & SlideContent)
  | { kind: "product"; name: string; price: string; tone: number }
  | { kind: "wordmark"; name: string }
  | { kind: "message"; text: string };

export interface DemoSlider {
  /** Element id, in the page and in the code samples. */
  id: string;
  /** The slider's accessible name, in the page and in the code samples. */
  label: string;
  /** A synced thumbnail strip: its slides are buttons, and it is a plain group. */
  thumbs?: boolean;
  /** The instance's variable name in the JS sample. */
  name?: string;
  /** Shown above the slider when an example has several. */
  caption?: string;
  /** Set as the container's inline style and printed as the CSS tab's rule. */
  vars?: CssVars;
  config?: SliderConfig;
  nav?: boolean;
  dots?: boolean;
  /** Arrow buttons hold text glyphs, as in the HTML sample, instead of the site's icons. */
  glyphNav?: boolean;
  slides: DemoSlide[];
  /** Library classes on the container; shown in the HTML sample. */
  className?: string;
  /** Site-only decoration on the container; left out of the samples. */
  chrome?: string;
  /** Attributes on the container; shown in the HTML sample. */
  attrs?: Record<string, string>;
  /** Class of a wrapper element around the slider; shown in the HTML sample. */
  wrapperClass?: string;
  /** The example's own script creates this slider, so the page does not start it. */
  manual?: boolean;
}

export interface Example {
  group: ExampleGroup;
  title: string;
  /** One sentence: what this is for. HTML. */
  lead: string;
  sliders: DemoSlider[];
  /** How several sliders sit: side by side from the small breakpoint up, or stacked. */
  layout?: "row" | "stack";
  /**
   * Show the HTML tab: `true` prints the sliders' markup, a string is the whole tab. Examples
   * whose markup is the plain Get started markup leave it out.
   */
  html?: boolean | string;
  /** Markup the example needs beside its sliders, appended to the HTML tab. */
  htmlAfter?: string;
  /** Stylesheet the demo runs, injected as written and appended to the CSS tab. */
  css?: string;
  /**
   * The JS tab: `body` replaces the createSlider lines, `after` follows them. The demo's wiring
   * in scripts/examples.ts runs the same steps.
   */
  js?: { imports?: string[]; body?: string; after?: string };
  /** "Good to know" bullets. HTML. */
  notes?: string[];
}

const plates = (labels: (string | number)[], extra: Partial<SlideContent> = {}): DemoSlide[] =>
  labels.map((num) => ({ num, ...extra }));
const numbered = (count: number): DemoSlide[] =>
  plates(Array.from({ length: count }, (_, i) => i + 1));

const productRowCss = `/* A peek of the next card on phones, whole rows from there up. */
#product-row {
  --aero-slides-per-view: 1.4;
  --aero-slide-gap: 12px;
  --aero-slide-aspect: auto; /* a card is as tall as its content */
}
@media (min-width: 640px) {
  #product-row {
    --aero-slides-per-view: 2.4;
  }
}
@media (min-width: 1024px) {
  #product-row {
    --aero-slides-per-view: 4;
    --aero-slide-gap: 16px;
  }
}`;

const mobileOnlyCss = `#collections {
  --aero-slides-per-view: 1.3;
  --aero-slide-gap: 12px;
}

/* From 768px up the slider is destroyed and the same markup is a grid. */
@media (min-width: 768px) {
  #collections .aero-slider__slides {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    width: auto;
  }
  #collections .aero-slider__slides > * {
    width: auto;
  }
}`;

const announcementCss = `/* A vertical slider is as tall as its viewport: one line of text here. */
#announcement .aero-slider__viewport {
  height: 2.75rem;
}`;

const edgeToEdgeCss = `/* Your page's content column: 72rem at most, inside the page gutter. */
:root {
  --page-gutter: 1rem;
  --content-column: calc(min(72rem, 100vw) - var(--page-gutter) * 2);
}
@media (min-width: 640px) {
  :root {
    --page-gutter: 1.5rem;
  }
}

/* The window's scrollbar would otherwise add a horizontal scroll. */
body {
  overflow-x: hidden;
}

/* Full-bleed wrapper: the track spans the whole window. */
.breakout-clip {
  width: 100vw;
  margin-left: calc(50% - 50vw);
}

/* Slides size against the column, not the window. */
#edge-to-edge {
  --aero-slides-per-view: 1.12;
  --aero-slide-gap: 12px;
  --aero-layout-width: var(--content-column);
}
@media (min-width: 640px) {
  #edge-to-edge {
    --aero-slides-per-view: 1.35;
    --aero-slide-gap: 18px;
  }
}`;

const styledCss = `#styled .aero-slider__nav--prev,
#styled .aero-slider__nav--next {
  position: absolute;
  top: 50%;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid rgb(255 255 255 / 0.16);
  border-radius: 50%;
  background: rgb(8 9 10 / 0.72);
  color: #eceef1;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  translate: 0 -50%;
  transition: border-color 0.15s, opacity 0.15s;
}
#styled .aero-slider__nav--prev {
  left: 12px;
}
#styled .aero-slider__nav--next {
  right: 12px;
}
#styled .aero-slider__nav--prev:hover,
#styled .aero-slider__nav--next:hover {
  border-color: #6aa5ff;
}
/* The slider disables an arrow that cannot go further. */
#styled .aero-slider__nav--prev:disabled,
#styled .aero-slider__nav--next:disabled {
  opacity: 0.3;
  cursor: default;
  border-color: rgb(255 255 255 / 0.16);
}

/* Each dot is a button larger than its mark, so it is easier to tap. */
#styled .aero-slider__pagination {
  gap: 0;
}
#styled .aero-slider__dot {
  display: grid;
  place-items: center;
  min-width: 16px;
  height: 24px;
  padding: 0 2px;
  border: 0;
  background: none;
}
#styled .aero-slider__dot::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background: #2d3036;
  transition: width 0.2s, background-color 0.2s;
}
/* The slider marks the current position's dot. */
#styled .aero-slider__dot--active::before {
  width: 20px;
  background: #6aa5ff;
}`;

const products: DemoSlide[] = [
  ["Field Watch", "$148"],
  ["Flight Jacket", "$320"],
  ["Aviator Glasses", "$96"],
  ["Kneeboard", "$42"],
  ["Headset Case", "$58"],
  ["Duffel 40L", "$184"],
  ["Leather Gloves", "$74"],
  ["Chart Pen", "$18"],
].map(([name, price], i) => ({
  kind: "product" as const,
  name: name!,
  price: price!,
  tone: i % 2 ? 4 : 1,
}));

/** The variant gallery's slides: three views per colour, then two that every colour shares. */
const variants = [
  { key: "graphite", label: "Graphite", tone: 1 },
  { key: "ceramic", label: "Ceramic", tone: 2 },
  { key: "blue", label: "Blue", tone: 3 },
] as const;
export const variantOptions = variants.map(({ key, label }) => ({ key, label }));
const variantSlides: DemoSlide[] = [
  ...variants.flatMap(({ key, label, tone }) =>
    ["Front", "Side", "Detail"].map((num) => ({ num, label, tone, variant: key }))
  ),
  { num: "Fit", label: "All colours", tone: 4 },
  { num: "Box", label: "All colours", tone: 4 },
];

const variantHtml = `<div id="swatches" role="group" aria-label="Colour">
  <button type="button" data-variant="graphite">Graphite</button>
  <button type="button" data-variant="ceramic">Ceramic</button>
  <button type="button" data-variant="blue">Blue</button>
</div>

<div id="variant-gallery" class="aero-slider" role="region" aria-roledescription="carousel" aria-label="Product images">
  <div class="aero-slider__viewport">
    <div class="aero-slider__track">
      <div class="aero-slider__slides">
        <!-- data-variant: shown for that colour only -->
        <div data-variant="graphite">Graphite, front</div>
        <div data-variant="graphite">Graphite, side</div>
        <div data-variant="ceramic">Ceramic, front</div>
        <div data-variant="ceramic">Ceramic, side</div>
        <div data-variant="blue">Blue, front</div>
        <div data-variant="blue">Blue, side</div>
        <!-- No data-variant: shown for every colour -->
        <div>Fit guide</div>
      </div>
    </div>
  </div>
</div>

<!-- One button per slide, in the same order, with the same data-variant -->
<div id="variant-thumbs" class="aero-slider" role="group" aria-label="Product image thumbnails">
  <div class="aero-slider__viewport">
    <div class="aero-slider__track">
      <div class="aero-slider__slides">
        <button type="button" data-variant="graphite" aria-label="Show graphite, front">…</button>
        <!-- … -->
        <button type="button" aria-label="Show fit guide">…</button>
      </div>
    </div>
  </div>
</div>`;

export const examples: Record<ExampleId, Example> = {
  "ex-product-row": {
    group: "controls",
    title: "Product row",
    lead: "Use it for a row of product cards: a peek of the next card on phones, whole rows on wider screens, and buttons that still click.",
    html: true,
    sliders: [
      {
        id: "product-row",
        label: "Best sellers",
        config: { alignment: "start", noDrag: "a, button" },
        nav: true,
        slides: products,
      },
    ],
    css: productRowCss,
    js: {
      after: `// The arrows turn a whole row: as many cards as fully fit.
const el = slider.element;
let perMove = 1;
function pageSize() {
  const fit = Math.floor(parseFloat(getComputedStyle(el).getPropertyValue("--aero-slides-per-view")));
  if (fit !== perMove) slider.update({ perMove: (perMove = fit) });
}
el.addEventListener("aero:resized", pageSize);
pageSize();`,
    },
    notes: [
      "<code>--aero-slides-per-view</code> takes fractions. The part after the point is how much of the next card shows.",
      "The slider re-reads <code>--aero-slides-per-view</code> whenever the track or a slide changes size, so a media query takes effect with no JavaScript breakpoint config.",
      "Card widths are worked out in CSS from the track width, the gap and the slides per view, so cards have their size before JavaScript runs.",
      "<code>--aero-slide-aspect: auto</code> lets a card take the height of its content. Leave it out to give every slide one shape.",
      "The slider stretches each direct child of a slide to fill it. Put a card's image, text and button inside one wrapper, as here, and lay them out in that.",
      "<code>noDrag</code> names what a mouse drag must not start on, so the link and the button click as usual. A press anywhere else on the card still drags, and touch is not affected.",
      "Without <code>noDrag</code>, a drag that starts on a link or button swallows the click that ends it.",
      "<code>perMove</code> sets how far the arrows, the arrow keys and autoplay go. Dragging still lands on any card.",
    ],
  },

  "ex-edge-to-edge": {
    group: "layout",
    title: "Edge-to-edge carousel",
    lead: "Use it when slides should run off both edges of the window while the active one lines up with your content column.",
    html: true,
    sliders: [
      {
        id: "edge-to-edge",
        label: "Featured",
        className: "aero-slider--breakout",
        wrapperClass: "breakout-clip",
        config: { alignment: "start", snap: "settle" },
        nav: true,
        dots: true,
        slides: [
          { num: 1, label: "Aligned", text: "The active card lines up with the content column." },
          { num: 2, label: "Bleed", text: "The track reaches both edges of the window." },
          { num: 3, label: "Column", text: "Slides size against the column, not the window." },
          { num: 4, label: "Wrapper", text: "Your page owns the full-bleed wrapper around it." },
          { num: 5, label: "Edges", text: "The first and last cards land on the column too." },
        ],
      },
    ],
    css: edgeToEdgeCss,
    notes: [
      "<code>aero-slider--breakout</code> lets the viewport overflow and pads the track so the first and last slides line up with the column.",
      "<code>--aero-layout-width</code> is the width slides are sized against. Set it to your content column.",
      '<code>snap: "settle"</code> lets a drag move freely, then eases onto the nearest card. A short pull on these wide cards springs back instead of moving a whole card.',
      "The edge padding is worked out from the track's own width, so it stays right with or without a scrollbar.",
      "The wrapper must span the window. Hide the page's horizontal overflow, because <code>100vw</code> includes the scrollbar.",
      "The dashed lines mark the column. The switch calls <code>update({ alignment })</code>.",
    ],
  },

  "ex-mobile-only": {
    group: "layout",
    title: "Slider on phones, grid on desktop",
    lead: "Use it when a set of tiles should swipe on a phone and sit in a plain grid on wider screens.",
    html: true,
    sliders: [
      {
        id: "collections",
        label: "Collections",
        manual: true,
        slides: ["Watches", "Outerwear", "Eyewear", "Bags", "Gloves", "Instruments"].map((num) => ({
          num,
          label: "Collection",
        })),
      },
    ],
    css: mobileOnlyCss,
    js: {
      body: `const el = document.getElementById("collections");
const phone = matchMedia("(max-width: 767px)");
let slider;

function sync() {
  if (phone.matches) {
    slider ??= createSlider(el);
  } else {
    slider?.destroy();
    slider = undefined;
  }
}
phone.addEventListener("change", sync);
sync();`,
    },
    notes: [
      "<code>destroy()</code> removes the slider's listeners, clones and classes and leaves your markup, so the same elements can be laid out as a grid and started again later.",
      "The library's classes are still in your markup, so the slides keep their flex row and their widths until your own CSS replaces them. Those are the two rules in the media query.",
      "Keep the breakpoint in the script and the one in the stylesheet the same.",
      "Resize the window across 768px to watch it switch.",
    ],
  },

  "ex-autoplay": {
    group: "motion",
    title: "Hero banner with autoplay",
    lead: "Use it when a banner should move through its slides on its own and step aside as soon as someone interacts.",
    html: true,
    sliders: [
      {
        id: "hero-banner",
        label: "Featured",
        attrs: { "data-aero-defer-visibility": "" },
        vars: {
          "--aero-slides-per-view": "1.2",
          "--aero-slide-aspect": "21 / 9",
          "--aero-slide-gap": "12px",
        },
        config: { autoplay: true, autoplayInterval: 4000, loop: true },
        nav: true,
        dots: true,
        slides: [
          { num: "Autumn", label: "New season", text: "Field jackets and wool layers, in now." },
          {
            num: "Watches",
            label: "Back in stock",
            text: "The Field Watch returns in three colours.",
          },
          {
            num: "Travel",
            label: "Collection",
            text: "Duffels and cases built for the overhead bin.",
          },
          { num: "Gifts", label: "Under $50", text: "Small things that get used every day." },
        ],
      },
    ],
    notes: [
      "The countdown restarts after any manual change, so a slide someone picks gets a full interval.",
      "It pauses on hover, on keyboard focus, while pressed or dragged, and while the tab is hidden.",
      "It does not run under <code>prefers-reduced-motion</code>, and stops as soon as that is turned on.",
      "<code>pause()</code> and <code>resume()</code> hold it from code, on top of those pauses.",
      "Without <code>loop</code> it returns to the first slide after the last.",
      "Autoplay that runs for more than five seconds needs a pause control. Wire your own button to <code>pause()</code> and <code>resume()</code>.",
      "A loop puts copies of the last slides in front of the first. Where the neighbours show, as here, slide 1 would start at the edge and jump to the centre when JavaScript runs. <code>data-aero-defer-visibility</code> reserves that space in CSS from the first paint, and the slider removes the attribute when it starts.",
      'The reserved space is worked out from <code>--aero-slides-per-view</code> and <code>--aero-slide-gap</code> for center alignment. With another <code>alignment</code>, repeat it in the HTML as <code>data-aero-alignment="start"</code> or <code>"end"</code>.',
    ],
  },

  "ex-ticker": {
    group: "motion",
    title: "Logo ticker",
    lead: "Use it for a strip of logos or press mentions that drifts steadily and never stops on a slide.",
    sliders: [
      {
        id: "ticker",
        label: "As seen in",
        vars: {
          "--aero-slides-per-view": "4",
          "--aero-slide-gap": "12px",
          "--aero-slide-aspect": "5 / 2",
        },
        config: { autoplay: "continuous", autoplaySpeed: 36, draggable: false },
        slides: [
          "Aurelo",
          "Novaline",
          "Quillbridge",
          "Stratum Six",
          "Ferrovane",
          "Lumenkin",
          "Orrery",
          "Halvard",
        ].map((name) => ({ kind: "wordmark" as const, name })),
      },
    ],
    notes: [
      '<code>autoplay: "continuous"</code> drifts the track at <code>autoplaySpeed</code> pixels per second. It implies <code>loop</code> and <code>snap: "none"</code>.',
      "The drift runs as animations on the slides with no per-frame JavaScript, so a busy main thread does not stall it.",
      "It keeps drifting under the pointer. It holds while the slider is pressed or keyboard focus is inside, and <code>pause()</code> / <code>resume()</code> apply on top.",
      "Wheel and trackpad scrolling add to the drift.",
      "Under <code>prefers-reduced-motion</code> the track stays still.",
      "<code>draggable: false</code> keeps a mouse press from grabbing the strip. Leave it on if people should scrub through it.",
    ],
  },

  "ex-announcement": {
    group: "motion",
    title: "Announcement bar",
    lead: "Use it for the strip above a store's header: short messages that roll up one at a time.",
    html: true,
    sliders: [
      {
        id: "announcement",
        label: "Announcements",
        className: "aero-slider--vertical",
        config: { vertical: true, autoplay: true, autoplayInterval: 3500, loop: true },
        slides: [
          "Free shipping on orders over $50",
          "Free returns within 30 days",
          "New: the Autumn field collection",
        ].map((text) => ({ kind: "message" as const, text })),
      },
    ],
    css: announcementCss,
    notes: [
      "<code>vertical: true</code> scrolls top to bottom, whatever the text direction of the page. The up and down arrow keys, the drag axis and a swipe all follow.",
      "A vertical slider gets its height from its viewport. Give the viewport a <code>height</code>, as here, or let it follow <code>--aero-slide-aspect</code>.",
      "The slider adds <code>aero-slider--vertical</code> itself. Putting the class in the markup as well lays the bar out before JavaScript runs.",
      "The autoplay rules from the hero banner apply: it pauses on hover and focus, and does not run under <code>prefers-reduced-motion</code>.",
    ],
  },

  "ex-gallery": {
    group: "controls",
    title: "Product gallery with thumbnails",
    lead: "Use it for a product page: a large view above a strip of thumbnails that stays in step with it.",
    html: true,
    layout: "stack",
    sliders: [
      {
        id: "gallery",
        label: "Product images",
        name: "main",
        caption: "Main slider",
        vars: { "--aero-slide-aspect": "16 / 9", "--aero-slide-gap": "12px" },
        nav: true,
        slides: plates([1, 2, 3, 4, 5], { label: "View" }),
      },
      {
        id: "gallery-thumbs",
        label: "Product image thumbnails",
        thumbs: true,
        name: "thumbs",
        caption: "Thumbnail strip",
        chrome: "aero-slider--thumbnails",
        vars: {
          "--aero-slides-per-view": "4",
          "--aero-slide-gap": "8px",
          "--aero-slide-aspect": "16 / 9",
        },
        config: { alignment: "center" },
        slides: numbered(5),
      },
    ],
    js: {
      imports: ["syncThumbnails"],
      after: `const teardown = syncThumbnails(main, thumbs);

// Before removing the sliders:
// teardown();
// main.destroy();
// thumbs.destroy();`,
    },
    notes: [
      "Both sliders need the same number of slides.",
      "The strip can still be dragged; a click without a drag selects a thumbnail. It makes the strip loop. Pass <code>{ loop: false }</code> as the third argument to keep it from looping.",
      '<code>alignment: "center"</code> on the strip keeps the active thumbnail in the middle.',
      'Make each thumbnail a <code>&lt;button type="button"&gt;</code> with its own <code>aria-label</code>, so it can be reached and named.',
      'The active thumbnail gets <code>aero-slider__thumb--active</code> and <code>aria-current="true"</code>. Style it yourself.',
      "It returns a teardown function. Call it before <code>destroy()</code>.",
      'Reference: <a href="#api-sync"><code>syncThumbnails</code> in the API</a>.',
    ],
  },

  "ex-variants": {
    group: "layout",
    title: "Gallery that follows the variant",
    lead: "Use it when a product's images change with the colour or flavour picked: each variant shows its own images plus the ones every variant shares.",
    html: variantHtml,
    layout: "stack",
    sliders: [
      {
        id: "variant-gallery",
        label: "Product images",
        name: "main",
        vars: { "--aero-slide-aspect": "16 / 9", "--aero-slide-gap": "12px" },
        nav: true,
        slides: variantSlides,
      },
      {
        id: "variant-thumbs",
        label: "Product image thumbnails",
        thumbs: true,
        name: "thumbs",
        chrome: "aero-slider--thumbnails",
        vars: {
          "--aero-slides-per-view": "4",
          "--aero-slide-gap": "8px",
          "--aero-slide-aspect": "16 / 9",
        },
        config: { alignment: "center" },
        slides: variantSlides,
      },
    ],
    js: {
      imports: ["syncThumbnails"],
      after: `syncThumbnails(main, thumbs);

// Hold on to every slide, in the row or out of it, so each image loads once.
const galleries = [main, thumbs].map((slider) => ({
  slider,
  row: slider.element.querySelector(".aero-slider__slides"),
  slides: [...slider.element.querySelectorAll("[data-aero-slider-index]")],
}));

function show(variant) {
  for (const { slider, row, slides } of galleries) {
    // A slide with no data-variant belongs to every variant.
    row.replaceChildren(
      ...slides.filter((slide) => (slide.dataset.variant ?? variant) === variant)
    );
    slider.refresh();
  }
  main.goTo(0, { instant: true }); // leave this out to stay on the same index
}

show("graphite");
document.getElementById("swatches").addEventListener("click", (event) => {
  const variant = event.target.closest("button")?.dataset.variant;
  if (variant) show(variant);
});`,
    },
    notes: [
      "<code>refresh()</code> re-reads the slides from <code>.aero-slider__slides</code>, so the slider becomes whatever elements are in it. Change the row first, then call it.",
      "Take slides out of the row to hide them. One hidden with CSS still counts as a slide, with its own stop and dot.",
      "<code>refresh()</code> rests on the same index as before. <code>goTo(0, { instant: true })</code> after it starts the new set from its first image. The swap and the jump happen before the browser paints, so nothing flashes in between. The switch above the gallery turns that jump on and off.",
      "Find slides by <code>data-aero-slider-index</code>, as here, and not by their place in the row. A looping slider also holds copies of its slides, and the thumbnail strip loops.",
      "Reusing the same elements keeps the images they have already loaded.",
      "No <code>slideChange</code> fires when the set changes under the same index. Update a counter or caption yourself after the swap.",
      'Slides named "2 of 5" in the markup need their names rewritten when the count changes.',
    ],
  },

  "ex-max-dots": {
    group: "controls",
    title: "Many slides, few dots",
    lead: "Use it when there are more positions than dots that fit, and the dots should scroll along with the active slide.",
    html: true,
    sliders: [
      {
        id: "max-dots",
        label: "Many slides",
        vars: { "--aero-slides-per-view": "2.5", "--aero-slide-gap": "12px" },
        config: { maxDots: 5 },
        nav: true,
        dots: true,
        slides: numbered(12),
      },
    ],
    notes: [
      "With more positions than <code>maxDots</code>, the dots sit in a window that slides to keep the active one in view.",
      "Dots at the window's edges get <code>aero-slider__dot--edge</code> and <code>aero-slider__dot--near-edge</code>, which the library's CSS shrinks.",
      "<code>0</code>, the default, shows every dot.",
    ],
  },

  "ex-counter": {
    group: "controls",
    title: "Counter and progress bar",
    lead: "Use it when a gallery should say “2 / 5” or fill a bar in place of dots, as most product pages do on a phone.",
    html: true,
    htmlAfter: `<p id="gallery-count">1 / 5</p>
<div class="progress"><div id="gallery-bar"></div></div>`,
    css: `.progress {
  height: 2px;
  background: #2d3036;
}
#gallery-bar {
  height: 100%;
  background: #6aa5ff;
  transition: width 0.25s;
}`,
    sliders: [
      {
        id: "counted",
        label: "Product images",
        vars: { "--aero-slide-aspect": "16 / 9", "--aero-slide-gap": "12px" },
        nav: true,
        slides: plates([1, 2, 3, 4, 5], { label: "View" }),
      },
    ],
    js: {
      after: `const count = document.getElementById("gallery-count");
const bar = document.getElementById("gallery-bar");

function show() {
  const position = slider.currentIndex + 1;
  count.textContent = \`\${position} / \${slider.slideCount}\`;
  bar.style.width = \`\${(position / slider.slideCount) * 100}%\`;
}
slider.element.addEventListener("aero:slideChange", show);
show(); // no slideChange fires for the starting slide`,
    },
    notes: [
      "<code>aero:slideChange</code> fires on the container as soon as the new slide is known, before the scroll lands, so the counter keeps up with a drag.",
      "Read <code>currentIndex</code> and <code>slideCount</code> from the instance, or the index from <code>event.detail.index</code>.",
      "The counter and bar are your own elements, anywhere on the page. Leave the pagination element out of the slider and it makes no dots.",
      "Call the function again after you change the slides and <code>refresh()</code>.",
    ],
  },

  "ex-styling": {
    group: "controls",
    title: "Arrows, dots and their states",
    lead: "Arrows and dots are markup, not options: put the elements inside the slider and it wires them up. The library lays them out and nothing more, so their look is yours.",
    html: true,
    sliders: [
      {
        id: "styled",
        label: "Styled controls",
        chrome: "ex-bare",
        vars: {
          "--aero-slides-per-view": "1.5",
          "--aero-slide-gap": "12px",
          "--aero-slide-aspect": "2 / 1",
        },
        nav: true,
        glyphNav: true,
        dots: true,
        slides: numbered(5),
      },
    ],
    css: styledCss,
    notes: [
      "Put the arrow buttons before the track, so keyboard users reach them before the slide content.",
      "The dot is one template. The slider clones it for each position it can scroll to.",
      'Give each button an <code>aria-label</code>. Make the dot a <code>&lt;button type="button"&gt;</code> too: a <code>&lt;span&gt;</code> cannot be reached by keyboard. <code>{index}</code> in its <code>aria-label</code> becomes the slide number of each dot.',
      "The viewport is <code>position: relative</code>, so arrows inside it can be placed with <code>position: absolute</code>.",
      "The slider sets <code>disabled</code> on an arrow that cannot go further, so <code>:disabled</code> styles the end state. With <code>loop</code> no arrow is ever disabled.",
      'The current dot gets <code>aero-slider__dot--active</code> and <code>aria-current="true"</code>.',
      "A dot this small is hard to tap. Make the button larger than the mark and draw the mark inside it, as the CSS here does with <code>::before</code>. Buttons 24px wide meet the WCAG target size, at the cost of dots set 24px apart.",
      'Every class the slider sets is listed under <a href="#api-states">States in the API</a>.',
    ],
  },
};

// ── Code samples ─────────────────────────────────────────────────────────

const SHOWN_SLIDES = 3;

export function styleOf(vars: CssVars = {}): string | undefined {
  const entries = Object.entries(vars);
  return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join("; ") : undefined;
}

const attrSource = (attrs: Record<string, string>) =>
  Object.entries(attrs)
    .map(([key, value]) => (value === "" ? ` ${key}` : ` ${key}="${value}"`))
    .join("");

/** What the page puts on the container, shared by the demo and its HTML sample. */
export function sliderRole(slider: DemoSlider): Record<string, string> {
  return slider.thumbs
    ? { role: "group", "aria-label": slider.label }
    : { role: "region", "aria-roledescription": "carousel", "aria-label": slider.label };
}

function slideSample(slider: DemoSlider, slide: DemoSlide, n: number, indent: string): string[] {
  if (slider.thumbs) return [`${indent}<button${attrSource(thumbRole(n))}>Thumbnail ${n}</button>`];
  const role = attrSource(slideRole(n, slider.slides.length));
  if (slide.kind === "product") {
    const slug = slide.name.toLowerCase().replace(/\W+/g, "-");
    return [
      `${indent}<div${role}>`,
      `${indent}  <article class="card">`,
      `${indent}    <img src="${slug}.jpg" alt="" />`,
      `${indent}    <a href="/products/${slug}">${slide.name}</a>`,
      `${indent}    <button type="button">Add to cart</button>`,
      `${indent}  </article>`,
      `${indent}</div>`,
    ];
  }
  if (slide.kind === "message") return [`${indent}<div${role}>${slide.text}</div>`];
  return [`${indent}<div${role}>Slide ${n}</div>`];
}

function sliderHtml(slider: DemoSlider): string[] {
  const indent = slider.wrapperClass ? "  " : "";
  const classes = ["aero-slider", slider.className].filter(Boolean).join(" ");
  const attrs = attrSource({ ...sliderRole(slider), ...slider.attrs });
  const shown = slider.slides.slice(0, SHOWN_SLIDES);
  const lines = [
    `<div id="${slider.id}" class="${classes}"${attrs}>`,
    `  <div class="aero-slider__viewport">`,
    ...(slider.nav
      ? [
          `    <button type="button" class="aero-slider__nav--prev" aria-label="Previous slide">‹</button>`,
          `    <button type="button" class="aero-slider__nav--next" aria-label="Next slide">›</button>`,
        ]
      : []),
    `    <div class="aero-slider__track">`,
    `      <div class="aero-slider__slides">`,
    ...shown.flatMap((slide, i) => slideSample(slider, slide, i + 1, "        ")),
    ...(slider.slides.length > shown.length
      ? [`        <!-- … ${slider.slides.length} slides in total -->`]
      : []),
    `      </div>`,
    `    </div>`,
    `  </div>`,
    ...(slider.dots
      ? [
          `  <div class="aero-slider__pagination" role="group" aria-label="Slides">`,
          `    <button type="button" class="aero-slider__dot" aria-label="Go to slide {index}"></button>`,
          `  </div>`,
        ]
      : []),
    `</div>`,
  ].map((line) => indent + line);
  return slider.wrapperClass ? [`<div class="${slider.wrapperClass}">`, ...lines, `</div>`] : lines;
}

function html(example: Example): string {
  if (typeof example.html === "string") return example.html;
  const sliders = example.sliders;
  return sliders
    .map((slider) => {
      const lines = sliderHtml(slider);
      return sliders.length > 1 && slider.caption
        ? [`<!-- ${slider.caption} -->`, ...lines].join("\n")
        : lines.join("\n");
    })
    .concat(example.htmlAfter ?? [])
    .join("\n\n");
}

function css(example: Example): string {
  const rules = example.sliders
    .filter((slider) => slider.vars)
    .map((slider) => {
      const lines = Object.entries(slider.vars!).map(([key, value]) => `  ${key}: ${value};`);
      return `#${slider.id} {\n${lines.join("\n")}\n}`;
    });
  if (example.css) rules.push(example.css);
  return rules.join("\n\n");
}

function literal(value: unknown): string {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

/** The config as it appears in the JS sample: `""` for none, else `, { … }`. */
export function configSource(config: SliderConfig = {}): string {
  const entries = Object.entries(config);
  if (!entries.length) return "";
  return `, {\n${entries.map(([key, value]) => `  ${key}: ${literal(value)},`).join("\n")}\n}`;
}

function js(example: Example): string {
  const imports = ["createSlider", ...(example.js?.imports ?? [])].join(", ");
  const lines = [
    `import { ${imports} } from "aero-slider";`,
    ``,
    ...(example.js?.body
      ? [example.js.body]
      : example.sliders.map(
          (slider) =>
            `const ${slider.name ?? "slider"} = createSlider(document.getElementById("${slider.id}")${configSource(slider.config)});`
        )),
  ];
  if (example.js?.after) lines.push(``, example.js.after);
  return lines.join("\n");
}

/** The example's code tabs, each rendered from the same entry the demo runs. */
export function exampleTabs(example: Example): CodeTab[] {
  const tabs: CodeTab[] = [];
  if (example.html) tabs.push({ label: "HTML", lang: "html", code: html(example) });
  const style = css(example);
  if (style) tabs.push({ label: "CSS", lang: "css", code: style });
  tabs.push({ label: "JS", lang: "javascript", code: js(example) });
  return tabs;
}

/** The examples in page order under their group, for menus. */
export const exampleNav = exampleGroups.map((group) => ({
  ...group,
  items: exampleIds
    .filter((id) => examples[id].group === group.key)
    .map((id) => ({ id, index: exampleIds.indexOf(id) + 1, title: examples[id].title })),
}));
