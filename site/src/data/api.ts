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
type InstanceGroup = (typeof instanceGroups)[number];
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
    description:
      "Wraps from the last slide back to the first. Clones of the slides sit on both sides of the track, so scrolling never hits an end.",
  },
  alignment: {
    group: "Layout",
    type: '"left" | "center" | "right"',
    default: '"center"',
    description:
      "Where the active slide rests in the viewport. At the ends of a non-looping track the scroll clamps, but <code>currentIndex</code> still names the focused slide.",
    example: "ex-alignment",
  },
  direction: {
    group: "Layout",
    type: '"ltr" | "rtl" | "ttb"',
    default: '"ltr"',
    description: "Left to right, right to left, or top to bottom (vertical).",
    example: "ex-direction",
  },
  perMove: {
    group: "Layout",
    type: "number",
    default: "1",
    description:
      "Slides advanced by each <code>next()</code> and <code>prev()</code>, and so by the arrows and autoplay.",
    example: "ex-per-move",
  },
  autoplay: {
    group: "Autoplay",
    type: 'boolean | "continuous"',
    default: "false",
    description:
      '<code>true</code> advances one move every <code>autoplayInterval</code>. <code>"continuous"</code> drifts the track like a ticker at <code>autoplaySpeed</code>, and implies <code>loop</code> and <code>snap: "none"</code>. Neither runs under reduced motion.',
    example: "ex-autoplay",
  },
  autoplayInterval: {
    group: "Autoplay",
    type: "number",
    default: "5000",
    description:
      "Milliseconds between advances. Any slide change restarts the countdown, and it holds while the slider is hovered, focused or pressed.",
    example: "ex-autoplay",
  },
  autoplaySpeed: {
    group: "Autoplay",
    type: "number",
    default: "40",
    description:
      'Speed of <code>"continuous"</code> autoplay in pixels per second. <code>0</code> or less keeps the track still.',
    example: "ex-ticker",
  },
  draggable: {
    group: "Interaction",
    type: "boolean",
    default: "true",
    description: "Lets a mouse or pen drag the track. Touch always swipes natively.",
  },
  noDrag: {
    group: "Interaction",
    type: "string",
    default: '""',
    description:
      'A selector for elements inside slides where a mouse drag should not start, e.g. <code>"a, button, input"</code>.',
    example: "ex-no-drag",
  },
  snap: {
    group: "Motion",
    type: '"native" | "settle" | "none"',
    default: '"native"',
    description:
      'How the track comes to rest. <code>"native"</code> uses CSS scroll snapping. <code>"settle"</code> scrolls freely, then eases onto the nearest slide. <code>"none"</code> stops wherever the scroll ends.',
    example: "ex-snap",
  },
  scrollDuration: {
    group: "Motion",
    type: "number",
    default: "0",
    description:
      "Length in ms of the scroll that <code>next()</code>, <code>prev()</code> and <code>goTo()</code> run, eased by <code>scrollEasing</code>, so it moves the same in every browser. <code>0</code> uses native smooth scrolling. Reduced motion makes every scroll instant.",
    example: "ex-snap",
  },
  scrollEasing: {
    group: "Motion",
    type: "(t: number) => number",
    default: "ease-out cubic",
    description:
      "Maps progress from 0 to 1 onto eased progress for <code>scrollDuration</code> scrolls. <code>(t) =&gt; t</code> is linear.",
  },
  maxDots: {
    group: "Pagination",
    type: "number",
    default: "0",
    description:
      "Shows at most this many pagination dots and slides the window along, iOS style. <code>0</code> shows them all.",
    example: "ex-max-dots",
  },
};

export const instanceMembers: Record<keyof SliderInstance, Doc<InstanceGroup>> = {
  next: {
    group: "Navigate",
    name: ".next()",
    description:
      "Moves forward by <code>perMove</code> slides. Stops at the last slide unless <code>loop</code> is on.",
  },
  prev: {
    group: "Navigate",
    name: ".prev()",
    description:
      "Moves back by <code>perMove</code> slides. Stops at the first slide unless <code>loop</code> is on.",
  },
  goTo: {
    group: "Navigate",
    name: ".goTo(index, options?)",
    description:
      "Scrolls to slide <code>index</code>. Out-of-range indexes wrap on a loop and clamp otherwise. <code>{ instant: true }</code> jumps there with no animation.",
  },
  pause: {
    group: "Autoplay",
    name: ".pause()",
    description:
      "Holds autoplay until <code>resume()</code>. Hover, focus and drag pauses still apply on top.",
  },
  resume: {
    group: "Autoplay",
    name: ".resume()",
    description: "Releases <code>pause()</code> and starts a fresh autoplay countdown.",
  },
  update: {
    group: "Change",
    name: ".update(config?)",
    description: "Merges new options into the config and rebuilds, keeping the current slide.",
  },
  refresh: {
    group: "Change",
    name: ".refresh()",
    description:
      "Re-reads the slides from the DOM and rebuilds. Call it after changing the track yourself.",
  },
  add: {
    group: "Change",
    name: ".add(slides, index?)",
    description:
      "Inserts one element or an array of them before slide <code>index</code>, or at the end, then rebuilds.",
  },
  remove: {
    group: "Change",
    name: ".remove(index)",
    description:
      "Removes the slide at <code>index</code>, or each slide in an array of indexes, then rebuilds.",
  },
  element: {
    group: "Read state",
    name: ".element",
    type: "HTMLElement",
    description: "The container the slider runs on.",
  },
  currentIndex: {
    group: "Read state",
    name: ".currentIndex",
    type: "number",
    description: "Index of the active slide. Loop clones are not counted.",
  },
  slideCount: {
    group: "Read state",
    name: ".slideCount",
    type: "number",
    description: "Number of slides, not counting loop clones.",
  },
  destroy: {
    group: "Lifecycle",
    name: ".destroy()",
    description:
      "Fires <code>aero:destroy</code>, then removes its listeners, clones and classes and deletes <code>element.aeroSlider</code>. Your markup stays, so <code>createSlider</code> can start it again.",
  },
};

/** What a button in the control demo works with. */
export interface ControlContext {
  /** The latest instance; destroyed once `slider.destroy()` has run. */
  slider: SliderInstance;
  el: HTMLElement;
  config: SliderConfig;
  createSlider: (element: HTMLElement, config?: SliderConfig) => SliderInstance;
  /** A new slide element, built like the others. */
  slide: () => HTMLElement;
}

export interface ControlAction {
  group: InstanceGroup;
  /** The call the button runs, shown as its label. */
  label: string;
  /** Whether the button needs a live slider or a destroyed one. */
  needs: "live" | "destroyed";
  /** Fewest slides the call leaves the demo usable with. */
  minSlides?: number;
  /** Returns the new instance when the call creates one. */
  run: (ctx: ControlContext) => SliderInstance | void;
}

// The control demo renders a button per row and runs `run` on click, so a
// label can't drift from what it does.
export const controlActions: ControlAction[] = [
  { group: "Navigate", label: "slider.prev()", needs: "live", run: ({ slider }) => slider.prev() },
  { group: "Navigate", label: "slider.next()", needs: "live", run: ({ slider }) => slider.next() },
  {
    group: "Navigate",
    label: "slider.goTo(3)",
    needs: "live",
    run: ({ slider }) => slider.goTo(3),
  },
  {
    group: "Navigate",
    label: "slider.goTo(0, { instant: true })",
    needs: "live",
    run: ({ slider }) => slider.goTo(0, { instant: true }),
  },
  {
    group: "Autoplay",
    label: "slider.pause()",
    needs: "live",
    run: ({ slider }) => slider.pause(),
  },
  {
    group: "Autoplay",
    label: "slider.resume()",
    needs: "live",
    run: ({ slider }) => slider.resume(),
  },
  {
    group: "Change",
    label: "slider.add(slide)",
    needs: "live",
    run: ({ slider, slide }) => slider.add(slide()),
  },
  {
    group: "Change",
    label: "slider.remove(slider.slideCount - 1)",
    needs: "live",
    minSlides: 2,
    run: ({ slider }) => slider.remove(slider.slideCount - 1),
  },
  {
    group: "Change",
    label: 'slider.update({ alignment: "left" })',
    needs: "live",
    run: ({ slider }) => slider.update({ alignment: "left" }),
  },
  {
    group: "Change",
    label: 'slider.update({ alignment: "center" })',
    needs: "live",
    run: ({ slider }) => slider.update({ alignment: "center" }),
  },
  {
    group: "Lifecycle",
    label: "slider.destroy()",
    needs: "live",
    run: ({ slider }) => slider.destroy(),
  },
  {
    group: "Lifecycle",
    label: "slider = createSlider(el, config)",
    needs: "destroyed",
    run: ({ el, config, createSlider }) => createSlider(el, config),
  },
];

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
    description:
      "How many slides fit the viewport. Fractions such as <code>1.5</code> show a peek of the next slide.",
    example: "ex-responsive",
  },
  { name: "--slide-gap", default: "0px", description: "Space between slides." },
  {
    name: "--slide-aspect",
    default: "5 / 3",
    description: "Aspect ratio of each slide, so the slider has its height before JavaScript runs.",
  },
  {
    name: "--aero-layout-width",
    default: "100%",
    description:
      "The content column for an <code>aero-slider--breakout</code> slider. Slides size to this column while the track runs to the edges of the screen.",
    example: "ex-edge-to-edge",
  },
];

export const attributes: RefEntry[] = [
  {
    name: "data-aero-defer-visibility",
    description:
      "Reserves the space that loop clones will take before the slider starts, so a looping slider doesn't shift when JavaScript runs. Removed once it starts.",
    example: "ex-no-shift",
  },
  {
    name: "data-aero-alignment",
    type: '"left" | "center" | "right"',
    description:
      "The slider sets this from <code>alignment</code>. Write it in your HTML too when you use a non-center alignment, so snapping and the reserved space match before JavaScript runs.",
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
