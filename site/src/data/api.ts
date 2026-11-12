import type { SliderConfig, SliderEvent, SliderInstance } from "aero-slider";
import type { CodeTab } from "../lib/code";
import type { ExampleId } from "./anchors";

/** One documented identifier, as a reference row renders it. */
export interface RefEntry {
  /** The identifier as shown, e.g. `loop`, `.goTo(index, options?)` or `aero:slideChange`. */
  name: string;
  type?: string;
  default?: string;
  /** HTML. */
  description: string;
  example?: ExampleId;
  /** Collapsed code shown under the description. */
  snippet?: CodeTab[];
}

export interface RefGroup {
  title: string;
  entries: RefEntry[];
}

/** A registry entry; `name` overrides the key when the shown identifier differs from it. */
type Doc<G extends string> = Omit<RefEntry, "name"> & { group: G; name?: string };

export const optionGroups = ["Layout", "Autoplay", "Interaction", "Motion", "Pagination"] as const;
export const instanceGroups = [
  "Navigate",
  "Autoplay",
  "Change",
  "Read state",
  "Lifecycle",
] as const;
export const eventGroups = [
  "Navigation",
  "Visibility",
  "Drag",
  "Autoplay",
  "Layout",
  "Lifecycle",
] as const;

// Keyed by the library's own types, so a new option, member or event fails the
// build until it is documented here.
export const options: Record<keyof SliderConfig, Doc<(typeof optionGroups)[number]>> = {
  loop: {
    group: "Layout",
    type: "boolean",
    default: "false",
    description: "Infinite looping",
  },
  alignment: {
    group: "Layout",
    type: '"left" | "center" | "right"',
    default: '"center"',
    description:
      "Align the active slide to the left, center, or right when possible. At non-loop edges the scroll position clamps, but <code>currentIndex</code> still reflects the focused slide.",
    example: "ex-alignment",
  },
  direction: {
    group: "Layout",
    type: '"ltr" | "rtl" | "ttb"',
    default: '"ltr"',
    description: "Carousel direction: left-to-right, right-to-left, or top-to-bottom (vertical)",
    example: "ex-direction",
  },
  perMove: {
    group: "Layout",
    type: "number",
    default: "1",
    description: "Number of slides to advance per <code>next()</code> / <code>prev()</code> call",
    example: "ex-per-move",
  },
  autoplay: {
    group: "Autoplay",
    type: 'boolean | "continuous"',
    default: "false",
    description:
      '<code>true</code> advances one move every <code>autoplayInterval</code>. <code>"continuous"</code> drifts the track smoothly like a ticker at <code>autoplaySpeed</code>; it implies <code>loop</code> and <code>snap: "none"</code>',
    example: "ex-autoplay",
  },
  autoplayInterval: {
    group: "Autoplay",
    type: "number",
    default: "5000",
    description:
      "Delay between auto-advances (ms). Restarts after any manual change, and holds while the slider is pressed",
    example: "ex-autoplay",
  },
  autoplaySpeed: {
    group: "Autoplay",
    type: "number",
    default: "40",
    description:
      "Continuous autoplay speed in pixels per second. <code>0</code> or less keeps the track still",
    example: "ex-ticker",
  },
  draggable: {
    group: "Interaction",
    type: "boolean",
    default: "true",
    description: "Enable mouse and pen dragging. Touch always swipes natively",
  },
  noDrag: {
    group: "Interaction",
    type: "string",
    default: '""',
    description:
      'CSS selector for elements inside slides that should not trigger drag (e.g. <code>"a, button, input"</code>)',
    example: "ex-no-drag",
  },
  snap: {
    group: "Motion",
    type: '"native" | "settle" | "none"',
    default: '"native"',
    description:
      'How the track comes to rest. <code>"native"</code> uses CSS scroll snapping. <code>"settle"</code> scrolls freely, then eases onto the nearest slide once scrolling stops (with <code>scrollDuration</code> / <code>scrollEasing</code>). <code>"none"</code> rests wherever the track stops',
    example: "ex-snap",
  },
  scrollDuration: {
    group: "Motion",
    type: "number",
    default: "0",
    description:
      "Length of <code>next()</code> / <code>prev()</code> / <code>goTo()</code> scrolls in ms, eased by <code>scrollEasing</code>, so they move the same way in every browser. <code>0</code> uses the browser's native smooth scrolling. Reduced motion makes every scroll instant either way",
    example: "ex-snap",
  },
  scrollEasing: {
    group: "Motion",
    type: "(t: number) =&gt; number",
    default: "ease-out cubic",
    description:
      "Maps linear progress 0–1 to eased progress for <code>scrollDuration</code> scrolls, e.g. <code>(t) =&gt; t</code> for linear",
  },
  maxDots: {
    group: "Pagination",
    type: "number",
    default: "0",
    description:
      "Max pagination dots (0 = unlimited); shows iOS-style sliding window when exceeded",
    example: "ex-max-dots",
  },
};

export const instanceMembers: Record<keyof SliderInstance, Doc<(typeof instanceGroups)[number]>> = {
  next: { group: "Navigate", name: ".next()", description: "Go to next slide" },
  prev: { group: "Navigate", name: ".prev()", description: "Go to previous slide" },
  goTo: {
    group: "Navigate",
    name: ".goTo(index, options?)",
    description:
      "Scroll to a specific slide index. Pass <code>{ instant: true }</code> to jump there with no animation",
  },
  pause: {
    group: "Autoplay",
    name: ".pause()",
    description:
      "Hold autoplay until <code>.resume()</code>. Hover, focus and drag pauses still apply on top",
  },
  resume: {
    group: "Autoplay",
    name: ".resume()",
    description: "Release a <code>.pause()</code> and restart the autoplay countdown",
  },
  update: { group: "Change", name: ".update(config?)", description: "Update config and re-render" },
  refresh: {
    group: "Change",
    name: ".refresh()",
    description: "Re-read slides from DOM and rebuild (call after external DOM changes)",
  },
  add: {
    group: "Change",
    name: ".add(slides, index?)",
    description: "Insert one or more slides into the track; calls refresh() automatically",
  },
  remove: {
    group: "Change",
    name: ".remove(index)",
    description: "Remove slide(s) by index (number or array); calls refresh() automatically",
  },
  element: {
    group: "Read state",
    name: ".element",
    type: "HTMLElement",
    description: "The container element the slider is attached to (read-only)",
  },
  currentIndex: {
    group: "Read state",
    name: ".currentIndex",
    type: "number",
    description: "Current active slide index (read-only)",
  },
  slideCount: {
    group: "Read state",
    name: ".slideCount",
    type: "number",
    description: "Total number of slides (read-only)",
  },
  destroy: { group: "Lifecycle", name: ".destroy()", description: "Tear down and clean up" },
};

export const events: Record<SliderEvent, Doc<(typeof eventGroups)[number]>> = {
  slideChange: {
    group: "Navigation",
    type: "{ index: number }",
    description: "Fired when the active slide changes",
  },
  visible: {
    group: "Visibility",
    type: "{ index: number }",
    description: "Fired per slide when it enters the visible range",
  },
  hidden: {
    group: "Visibility",
    type: "{ index: number }",
    description: "Fired per slide when it leaves the visible range",
  },
  dragStart: {
    group: "Drag",
    type: "{ index: number }",
    description:
      "Fired when a mouse or pen drag starts (touch scrolls natively and doesn't fire drag events)",
  },
  dragEnd: {
    group: "Drag",
    type: "{ index: number; fromIndex: number }",
    description: "Fired when a mouse or pen drag is released, after the target slide is chosen",
  },
  autoplayStart: {
    group: "Autoplay",
    type: "{}",
    description: "Fired when autoplay starts or resumes",
  },
  autoplayStop: { group: "Autoplay", type: "{}", description: "Fired when autoplay pauses" },
  resize: {
    group: "Layout",
    type: "{}",
    description:
      "Fired when the track or slide size changes, e.g. a window resize or a CSS variable such as <code>--slides-per-view</code> changing (before re-measuring)",
  },
  resized: {
    group: "Layout",
    type: "{}",
    description: "Fired after the slider finishes updating from a resize",
  },
  ready: {
    group: "Lifecycle",
    type: "{}",
    description: "Fired once after initialization (listen before <code>createSlider</code>)",
  },
  destroy: {
    group: "Lifecycle",
    type: "{}",
    description: "Fired at the start of <code>destroy()</code>, before teardown",
  },
};

export const cssVariables: RefEntry[] = [
  {
    name: "--slides-per-view",
    default: "1",
    description: "Number of visible slides (supports fractional, e.g. 1.5)",
  },
  { name: "--slide-gap", default: "0px", description: "Gap between slides" },
  { name: "--slide-aspect", default: "5 / 3", description: "Aspect ratio for slides" },
  {
    name: "--aero-layout-width",
    default: "100%",
    description:
      "Content column width for <code>aero-slider--breakout</code> sliders. Slides size to this column while the track spans the full width; edge gutters are derived automatically.",
    example: "ex-edge-to-edge",
  },
];

export const attributes: RefEntry[] = [
  {
    name: "data-aero-defer-visibility",
    description:
      "Prevents layout shift before JS init in loop mode by reserving space for prepended clones. Pair it with <code>data-aero-alignment</code> in HTML when mirroring a non-default pre-init alignment; center is assumed otherwise.",
    example: "ex-no-shift",
  },
  {
    name: "data-aero-alignment",
    type: '"left" | "center" | "right"',
    description:
      "Mirrors the <code>alignment</code> option, which the slider sets at init. Set it in HTML as well so snapping and the <code>data-aero-defer-visibility</code> spacer match before JavaScript runs.",
    example: "ex-no-shift",
  },
];

export const stateClasses: RefEntry[] = [
  { name: "aero-slider--ready", description: "The slider has initialized" },
  {
    name: "aero-slider--draggable",
    description:
      "<code>draggable</code> is on. The track shows the <code>grab</code> cursor only then",
  },
  {
    name: "aero-slider--dragging",
    description: "A mouse or pen drag is in progress (<code>grabbing</code> cursor)",
  },
  {
    name: "aero-slider--free",
    description:
      '<code>snap</code> is <code>"settle"</code> or <code>"none"</code>. Turns CSS scroll snapping off',
  },
  { name: "aero-slider--vertical", description: '<code>direction</code> is <code>"ttb"</code>' },
];

export const globals: RefEntry[] = [
  {
    name: "AeroSlider.createSlider",
    description: "Same as the module <code>createSlider</code> — creates a slider instance",
  },
  {
    name: "AeroSlider.syncThumbnails",
    description:
      "Same as the module <code>syncThumbnails</code> — syncs primary and thumbnail sliders",
  },
];

/** Groups a registry in the given group order; `display` maps a key to its shown name. */
export function toRefGroups<G extends string, K extends string>(
  registry: Record<K, Doc<G>>,
  order: readonly G[],
  display: (key: K) => string = (key) => key
): RefGroup[] {
  const docs = Object.entries(registry) as [K, Doc<G>][];
  return order.map((title) => ({
    title,
    entries: docs
      .filter(([, doc]) => doc.group === title)
      .map(([key, { group: _, name, ...rest }]) => ({ ...rest, name: name ?? display(key) })),
  }));
}

export const optionRefGroups = toRefGroups(options, optionGroups);
export const instanceRefGroups = toRefGroups(instanceMembers, instanceGroups);
export const eventRefGroups = toRefGroups(events, eventGroups, (key) => `aero:${key}`);
