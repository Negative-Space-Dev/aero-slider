// One definition per example. The Astro section renders the demo and its code
// tabs from it, and the client script starts the demo from the same `config`,
// so the code shown is the code that runs. No Astro imports: the client script
// bundles this module too.

import type { SliderConfig } from "aero-slider";
import type { CodeTab } from "../lib/code";
import { slideRole, thumbRole, type SlideContent } from "../lib/slide";
import { exampleIds, type ExampleId } from "./anchors";
import type { RefEntry } from "./api";

export const exampleGroups = [
  { key: "layout", id: "examples-layout", title: "Layout" },
  { key: "motion", id: "examples-motion", title: "Motion" },
  { key: "controls", id: "examples-controls", title: "Controls" },
] as const;

export type ExampleGroup = (typeof exampleGroups)[number]["key"];

export type CssVars = Record<`--${string}`, string>;

/** What a demo slide shows. The code samples stand each one in as a plain `<div>`. */
export type DemoSlide =
  | ({ kind?: "plate" } & SlideContent)
  | { kind: "card"; meta: string; title: string; text: string }
  | { kind: "wordmark"; name: string }
  | { kind: "form"; title: string; field: string; action: string };

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
  /** False for a demo-only comparison slider that the code tabs leave out. */
  sample?: boolean;
}

export interface Example {
  group: ExampleGroup;
  title: string;
  /** One sentence: what this is for. HTML. */
  lead: string;
  sliders: DemoSlider[];
  /** How several sliders sit: side by side from the small breakpoint up, or stacked. */
  layout?: "row" | "stack";
  /** Show the HTML tab. Examples whose markup is the plain Get started markup leave it out. */
  html?: boolean;
  /** Stylesheet the demo runs, injected as written and appended to the CSS tab. */
  css?: string;
  /** Code that runs after the sliders are created, appended to the JS tab. */
  js?: { imports: string[]; after: string };
  /** "Good to know" bullets. HTML. */
  notes?: string[];
}

const plates = (labels: (string | number)[], extra: Partial<SlideContent> = {}): DemoSlide[] =>
  labels.map((num) => ({ num, ...extra }));
const numbered = (count: number): DemoSlide[] =>
  plates(Array.from({ length: count }, (_, i) => i + 1));

const responsiveCss = `/* One slide on phones, two on tablets, three on desktops. */
#responsive {
  --aero-slides-per-view: 1;
  --aero-slide-gap: 8px;
}
@media (min-width: 640px) {
  #responsive {
    --aero-slides-per-view: 2;
    --aero-slide-gap: 12px;
  }
}
@media (min-width: 1024px) {
  #responsive {
    --aero-slides-per-view: 3;
    --aero-slide-gap: 16px;
  }
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

#styled .aero-slider__dot {
  width: 6px;
  height: 6px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: #2d3036;
  transition: width 0.2s, background-color 0.2s;
}
/* The slider marks the current position's dot. */
#styled .aero-slider__dot--active {
  width: 20px;
  background: #6aa5ff;
}`;

export const examples: Record<ExampleId, Example> = {
  "ex-card-row": {
    group: "layout",
    title: "Card row with a peek",
    lead: "Use it when several cards should show at once and a partly visible card should hint that there is more.",
    sliders: [
      {
        id: "card-row",
        label: "Product features",
        vars: {
          "--aero-slides-per-view": "2.25",
          "--aero-slide-gap": "16px",
          "--aero-slide-aspect": "4 / 3",
        },
        nav: true,
        dots: true,
        slides: [
          ["Telemetry", "Live readings from every sensor on one screen."],
          ["Flight plans", "Draft a route, check it and file it."],
          ["Weather", "Winds aloft and ceilings along the route."],
          ["Logbook", "Every hour flown, signed and searchable."],
          ["Checklists", "Each phase in order, nothing skipped."],
          ["Maintenance", "Parts, hours and the next inspection due."],
        ].map(([title, text], i) => ({
          kind: "card" as const,
          meta: `Module ${String(i + 1).padStart(2, "0")}`,
          title,
          text,
        })),
      },
    ],
    notes: [
      "<code>--aero-slides-per-view</code> takes fractions. The part after the point is how much of the next card shows.",
      "Slide width is worked out in CSS from the track width, the gap and the slides per view, so cards have their size before JavaScript runs.",
      "<code>--aero-slide-aspect</code> sets each card's height from its width.",
    ],
  },

  "ex-responsive": {
    group: "layout",
    title: "Responsive breakpoints",
    lead: "Use it when the number of slides in view should change with the screen width.",
    sliders: [
      { id: "responsive", label: "Responsive slides", nav: true, dots: true, slides: numbered(6) },
    ],
    css: responsiveCss,
    notes: [
      "The slider re-reads <code>--aero-slides-per-view</code> whenever the track or a slide changes size, so a media query takes effect with no JavaScript breakpoint config.",
      "<code>--aero-slide-gap</code> and <code>--aero-slide-aspect</code> are plain CSS and can change in the same media queries.",
      "Resize the window to watch it switch between one, two and three slides.",
    ],
  },

  "ex-alignment": {
    group: "layout",
    title: "Alignment",
    lead: "Use it when the active slide should rest against the start or end edge instead of the center.",
    layout: "row",
    sliders: (["start", "center", "end"] as const).map((alignment) => ({
      id: `align-${alignment}`,
      label: `Aligned ${alignment}`,
      name: alignment,
      caption: alignment,
      vars: { "--aero-slides-per-view": "1.5", "--aero-slide-gap": "12px" },
      config: { alignment, loop: true },
      slides: plates(["A", "B", "C", "D"]),
    })),
    notes: [
      "<code>center</code> is the default.",
      "The values are logical. <code>start</code> is the left edge here, the right edge in a right-to-left slider and the top edge in a vertical one.",
      "Without <code>loop</code>, the first and last slides cannot reach the alignment point. The track stops at its end, and <code>currentIndex</code> still reports the slide in focus.",
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
        config: { alignment: "start" },
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
      "The edge padding is worked out from the track's own width, so it stays right with or without a scrollbar.",
      "The wrapper must span the window. Hide the page's horizontal overflow, because <code>100vw</code> includes the scrollbar.",
      "The dashed lines mark the column. The switch calls <code>update({ alignment })</code>.",
    ],
  },

  "ex-direction": {
    group: "layout",
    title: "Right-to-left and vertical",
    lead: "Use it for right-to-left languages, or when slides should stack and scroll vertically.",
    layout: "row",
    sliders: [
      {
        id: "rtl",
        label: "Right-to-left slides",
        name: "rtl",
        caption: "rtl",
        config: { direction: "rtl" },
        nav: true,
        dots: true,
        slides: plates([..."אבגד"]),
      },
      {
        id: "vertical",
        label: "Vertical slides",
        name: "vertical",
        caption: "ttb",
        config: { direction: "ttb" },
        dots: true,
        slides: numbered(4),
      },
    ],
    notes: [
      "Arrow keys, the drag axis and the scroll axis all follow the direction. A vertical slider moves with the up and down keys.",
      '<code>"rtl"</code> sets <code>dir="rtl"</code> on the container.',
      "A vertical slider takes its height from <code>--aero-slide-aspect</code>. <code>--aero-slides-per-view</code> and <code>--aero-slide-gap</code> work along the vertical axis.",
    ],
  },

  "ex-no-shift": {
    group: "layout",
    title: "Loop without layout shift",
    lead: "Use it when a looping slider shows on first paint and must not move when JavaScript starts.",
    html: true,
    layout: "row",
    sliders: [
      {
        id: "no-shift-before",
        label: "Without the attribute",
        caption: "Without the attribute",
        sample: false,
        vars: { "--aero-slides-per-view": "1.5", "--aero-slide-gap": "12px" },
        config: { loop: true },
        slides: numbered(5),
      },
      {
        id: "no-shift",
        label: "With the attribute",
        caption: "With data-aero-defer-visibility",
        attrs: { "data-aero-defer-visibility": "" },
        vars: { "--aero-slides-per-view": "1.5", "--aero-slide-gap": "12px" },
        config: { loop: true },
        slides: numbered(5),
      },
    ],
    notes: [
      "A loop puts copies of the last slides in front of the first, so you can scroll back from slide 1. Until JavaScript adds them, slide 1 sits at the start of the track, then moves.",
      "<code>data-aero-defer-visibility</code> reserves that space in CSS from the first paint. The slider removes the attribute when it starts.",
      'The space is worked out for center alignment. With another <code>alignment</code>, repeat it in the HTML as <code>data-aero-alignment="start"</code> or <code>"end"</code>.',
      "Set <code>--aero-slides-per-view</code> and <code>--aero-slide-gap</code> in CSS. The reserved space is computed from them.",
      "Use it only with <code>loop</code>. Without loop nothing is added in front, so there is nothing to reserve.",
      "Replay start-up removes both sliders and starts them again after a pause, which is what a page load looks like.",
    ],
  },

  "ex-autoplay": {
    group: "motion",
    title: "Hero banner with autoplay",
    lead: "Use it when a banner should move through its slides on its own and step aside as soon as someone interacts.",
    sliders: [
      {
        id: "hero-banner",
        label: "Flight phases",
        vars: { "--aero-slide-aspect": "21 / 9" },
        config: { autoplay: true, autoplayInterval: 4000, loop: true },
        nav: true,
        dots: true,
        slides: [
          { num: "Ascent", label: "01 / 04", text: "Clear the field, climb to cruise." },
          { num: "Orbit", label: "02 / 04", text: "Hold the line, trim for the long haul." },
          { num: "Descent", label: "03 / 04", text: "Plan the arrival, step down on profile." },
          { num: "Landing", label: "04 / 04", text: "Stable on final, wheels on the numbers." },
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
    ],
  },

  "ex-ticker": {
    group: "motion",
    title: "Logo ticker",
    lead: "Use it for a strip of logos or announcements that drifts steadily and never stops on a slide.",
    sliders: [
      {
        id: "ticker",
        label: "Customers",
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

  "ex-snap": {
    group: "motion",
    title: "Snap modes",
    lead: "Use it when snapping on every slide feels abrupt under a trackpad, or when the track should rest wherever it stops.",
    layout: "stack",
    sliders: [
      {
        id: "snap-settle",
        label: "Settle snap",
        name: "settle",
        caption: 'snap: "settle"',
        vars: { "--aero-slides-per-view": "3", "--aero-slide-gap": "12px" },
        config: { loop: true, snap: "settle", scrollDuration: 550 },
        slides: numbered(8),
      },
      {
        id: "snap-none",
        label: "Free scroll",
        name: "free",
        caption: 'snap: "none"',
        vars: { "--aero-slides-per-view": "3", "--aero-slide-gap": "12px" },
        config: { snap: "none" },
        slides: numbered(8),
      },
    ],
    notes: [
      'The default, <code>"native"</code>, is CSS scroll snapping.',
      '<code>"settle"</code> scrolls freely under a drag, swipe or trackpad, then eases onto the nearest slide once scrolling stops, using <code>scrollDuration</code> and <code>scrollEasing</code>. Try a slow trackpad scroll on the first slider.',
      '<code>"none"</code> rests wherever the track stops, and a mouse drag coasts on its release speed.',
      "Both add <code>aero-slider--free</code> to the container, which turns CSS snapping off.",
    ],
  },

  "ex-per-move": {
    group: "motion",
    title: "Page by page",
    lead: "Use it when the arrows should turn a whole page of slides at a time.",
    sliders: [
      {
        id: "per-move",
        label: "Paged slides",
        vars: { "--aero-slides-per-view": "3", "--aero-slide-gap": "12px" },
        config: { alignment: "start", perMove: 3 },
        nav: true,
        slides: numbered(12),
      },
    ],
    notes: [
      "<code>perMove</code> sets how far <code>next()</code> and <code>prev()</code> go. The arrows, the arrow keys and autoplay all use them.",
      "Dragging and <code>goTo()</code> still land on any slide.",
      'With <code>alignment: "start"</code> and a whole number of slides in view, the last stop is the last full page.',
    ],
  },

  "ex-arrows-dots": {
    group: "controls",
    title: "Arrows and dots",
    lead: "Arrows and dots are markup, not JavaScript options. Put the elements inside the slider and it finds them and wires them up.",
    html: true,
    layout: "row",
    sliders: [
      {
        id: "with-arrows",
        label: "Slides with arrows",
        name: "arrows",
        caption: "Arrows",
        nav: true,
        slides: numbered(3),
      },
      {
        id: "with-dots",
        label: "Slides with dots",
        name: "dots",
        caption: "Dots",
        dots: true,
        slides: numbered(3),
      },
    ],
    notes: [
      "Put the buttons before the track, so keyboard users reach them before the slide content.",
      "The dot is one template. The slider clones it for each position it can scroll to and marks the current one with <code>aero-slider__dot--active</code>.",
      "Without <code>loop</code>, the slider disables the arrow at an end it cannot pass.",
      'Give each button an <code>aria-label</code>. Make the dot a <code>&lt;button type="button"&gt;</code> too: a <code>&lt;span&gt;</code> cannot be reached by keyboard. <code>{index}</code> in its <code>aria-label</code> becomes the slide number of each dot.',
      'The library has no styles for the arrows or the dots. See <a href="#ex-styling">Style the arrows, dots and states</a>.',
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
        vars: { "--aero-slide-aspect": "16 / 9" },
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
      "It turns dragging off on the strip, so a press always selects, and makes the strip loop. Pass <code>{ loop: false }</code> as the third argument to keep it from looping.",
      '<code>alignment: "center"</code> on the strip keeps the active thumbnail in the middle.',
      'Make each thumbnail a <code>&lt;button type="button"&gt;</code> with its own <code>aria-label</code>, so it can be reached and named.',
      'The active thumbnail gets <code>aero-slider__thumb--active</code> and <code>aria-current="true"</code>. Style it yourself.',
      "It returns a teardown function. Call it before <code>destroy()</code>.",
      'Reference: <a href="#api-sync"><code>syncThumbnails</code> in the API</a>.',
    ],
  },

  "ex-no-drag": {
    group: "controls",
    title: "Buttons and links inside slides",
    lead: "Use it when slides hold buttons, links or form fields that must work with a mouse.",
    html: true,
    sliders: [
      {
        id: "no-drag",
        label: "Radio settings",
        vars: {
          "--aero-slides-per-view": "1.5",
          "--aero-slide-gap": "12px",
          "--aero-slide-aspect": "2 / 1",
        },
        config: { noDrag: "a, button, input" },
        dots: true,
        slides: [
          { kind: "form", title: "Callsign", field: "Callsign", action: "Save" },
          { kind: "form", title: "Squawk code", field: "Squawk", action: "Set" },
          { kind: "form", title: "Frequency", field: "MHz", action: "Tune" },
        ],
      },
    ],
    notes: [
      "A mouse or pen press that starts on an element matching <code>noDrag</code> does not start a drag. The button clicks and the field selects text as usual.",
      "A press anywhere else on the slide still drags.",
      "Touch is not affected. A swipe scrolls natively wherever it starts.",
      "Arrow keys typed in a text field move the caret, not the slider.",
      "Without <code>noDrag</code>, a drag that starts on a link or button swallows the click that ends it.",
    ],
  },

  "ex-styling": {
    group: "controls",
    title: "Style the arrows, dots and states",
    lead: "Use it when you style the controls yourself. The library ships layout only: no look for the arrows and no size or colour for the dots.",
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
      "The viewport is <code>position: relative</code>, so arrows inside it can be placed with <code>position: absolute</code>.",
      "The slider sets <code>disabled</code> on an arrow that cannot go further, so <code>:disabled</code> styles the end state. With <code>loop</code> no arrow is ever disabled.",
      'The current dot gets <code>aero-slider__dot--active</code> and <code>aria-current="true"</code>.',
      "The classes below are what the slider sets, for styling any other state.",
    ],
  },
};

/** Classes the slider sets on the controls, listed beside the container's state classes. */
export const controlStates: RefEntry[] = [
  {
    name: "aero-slider__dot--active",
    description: "The dot for the current position",
  },
  {
    name: ":disabled",
    description:
      "Set on <code>aero-slider__nav--prev</code> or <code>--next</code> when it cannot go further. Never with <code>loop</code>",
  },
  {
    name: "aero-slider__dot--edge",
    description:
      "With <code>maxDots</code>: the outermost dot of the window when more dots lie beyond it. <code>aero-slider__dot--near-edge</code> marks the next one in, and <code>aero-slider__dot--hidden</code> the dots outside the window",
  },
  {
    name: "aero-slider__thumb--active",
    description: "Set by <code>syncThumbnails</code> on the thumbnail of the current slide",
  },
];

// ── Code samples ─────────────────────────────────────────────────────────

const SHOWN_SLIDES = 3;

export function styleOf(vars: CssVars = {}): string | undefined {
  const entries = Object.entries(vars);
  return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join("; ") : undefined;
}

const sampled = (example: Example) => example.sliders.filter((slider) => slider.sample !== false);

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
  if (slide.kind === "form") {
    return [
      `${indent}<div${role}>`,
      `${indent}  <input type="text" aria-label="${slide.field}" />`,
      `${indent}  <button type="button">${slide.action}</button>`,
      `${indent}</div>`,
    ];
  }
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
    ...shown.flatMap((slide, i) => slideSample(slider, slide, i + 1, "      ")),
    ...(slider.slides.length > shown.length
      ? [`      <!-- … ${slider.slides.length} slides in total -->`]
      : []),
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
  const sliders = sampled(example);
  return sliders
    .map((slider) => {
      const lines = sliderHtml(slider);
      return sliders.length > 1 && slider.caption
        ? [`<!-- ${slider.caption} -->`, ...lines].join("\n")
        : lines.join("\n");
    })
    .join("\n\n");
}

function css(example: Example): string {
  const rules = sampled(example)
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
    ...sampled(example).map(
      (slider) =>
        `const ${slider.name ?? "slider"} = createSlider(document.getElementById("${slider.id}")${configSource(slider.config)});`
    ),
  ];
  if (example.js) lines.push(``, example.js.after);
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
