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

type EventGroup = (typeof eventGroups)[number];

/** An event's reference row: when it fires, what it is for, and a working recipe. */
export interface EventDoc {
  group: EventGroup;
  /** The type of `event.detail`. */
  type: string;
  /** When it fires. HTML. */
  description: string;
  /** What it is useful for. HTML. */
  useFor: string;
  /** In the recipes, `el` is the slider's container. */
  snippet: CodeTab[];
}

const recipe = (code: string): CodeTab[] => [{ label: "Recipe", lang: "javascript", code }];

export const events: Record<SliderEvent, EventDoc> = {
  slideChange: {
    group: "Navigation",
    type: "{ index: number }",
    description:
      "The active slide changed, by arrows, dots, keys, a drag or swipe, autoplay or a method call. It fires as soon as the new slide is known, before the scroll lands.",
    useFor: "A “2 / 5” counter, analytics, or keeping your own UI in step with the slider.",
    snippet: recipe(`const counter = document.querySelector(".slide-counter");
const slider = createSlider(el, { loop: true });
const show = (index) => {
  counter.textContent = \`\${index + 1} / \${slider.slideCount}\`;
};

show(slider.currentIndex); // no slideChange for the starting slide
el.addEventListener("aero:slideChange", (event) => show(event.detail.index));`),
  },
  visible: {
    group: "Visibility",
    type: "{ index: number }",
    description:
      "A slide came into view, even partly. Loop clones report the index of the slide they copy. Once the slider starts, it fires for every slide already in view.",
    useFor: "Lazy-loading an image or starting a video when its slide comes into view.",
    snippet: recipe(`// Each slide holds <img data-src="photo.jpg" alt="">.
el.addEventListener("aero:visible", (event) => {
  const track = el.querySelector(".aero-slider__track");
  // Real slides carry data-aero-slider-index; loop clones don't.
  const slide = track.querySelector(\`[data-aero-slider-index="\${event.detail.index}"]\`);
  const src = slide.querySelector("img[data-src]")?.dataset.src;
  if (!src) return;
  // Clones are copies of the slide, so load every copy of the image.
  for (const img of track.querySelectorAll("img[data-src]")) {
    if (img.dataset.src !== src) continue;
    img.src = src;
    img.removeAttribute("data-src");
  }
});
createSlider(el, { loop: true });`),
  },
  hidden: {
    group: "Visibility",
    type: "{ index: number }",
    description: "A slide went fully out of view.",
    useFor: "Pausing a video, or any other work, when its slide leaves the view.",
    snippet: recipe(`// Some slides hold <video muted playsinline loop>.
// A loop comes to rest on real slides, so the real copy is the one in view.
const videoIn = (index) =>
  el.querySelector(\`[data-aero-slider-index="\${index}"] video\`);

el.addEventListener("aero:visible", (event) => videoIn(event.detail.index)?.play());
el.addEventListener("aero:hidden", (event) => videoIn(event.detail.index)?.pause());`),
  },
  dragStart: {
    group: "Drag",
    type: "{ index: number }",
    description:
      "A mouse or pen drag moved past a few pixels and took over the track. <code>index</code> is the slide it started from.",
    useFor: "Reacting to the first drag, such as removing a “drag to explore” hint.",
    snippet: recipe(`const hint = el.querySelector(".drag-hint");
el.addEventListener("aero:dragStart", () => hint.remove(), { once: true });`),
  },
  dragEnd: {
    group: "Drag",
    type: "{ index: number; fromIndex: number }",
    description:
      "The drag was released and the slider chose where to settle. <code>fromIndex</code> is where it started, <code>index</code> where it is going.",
    useFor:
      "Logging swipes. You don't need it to block clicks: the slider already swallows the click that ends a drag.",
    snippet: recipe(`el.addEventListener("aero:dragEnd", (event) => {
  const { fromIndex, index } = event.detail;
  if (index !== fromIndex) console.log(\`dragged from \${fromIndex} to \${index}\`);
});`),
  },
  autoplayStart: {
    group: "Autoplay",
    type: "{}",
    description:
      "Autoplay began running: at start, when <code>update()</code> turns it on, and each time a hover, focus, press or <code>pause()</code> lets go. Never under reduced motion.",
    useFor: "A progress bar or a playing light that matches what autoplay is really doing.",
    snippet:
      recipe(`// <div class="autoplay-bar"> with transform-origin: left, inside the container.
const interval = 4000;
const bar = el.querySelector(".autoplay-bar");
let fill = null;
const restart = () => {
  fill?.cancel();
  fill = bar.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
    duration: interval,
  });
};

el.addEventListener("aero:autoplayStart", restart);
// Every slide change restarts the countdown, so the bar starts over too.
el.addEventListener("aero:slideChange", () => fill && restart());
el.addEventListener("aero:autoplayStop", () => {
  fill?.cancel();
  fill = null;
});
createSlider(el, { autoplay: true, autoplayInterval: interval, loop: true });`),
  },
  autoplayStop: {
    group: "Autoplay",
    type: "{}",
    description:
      "Autoplay stopped running: on hover, keyboard focus, a press or drag, <code>pause()</code>, a hidden tab, <code>update()</code> turning it off, or <code>destroy()</code>.",
    useFor:
      "Taking that progress bar or light down again. Pair it with <code>aero:autoplayStart</code>.",
    snippet: recipe(`// Style .is-playing as an indicator light that is on while autoplay runs.
el.addEventListener("aero:autoplayStart", () => el.classList.add("is-playing"));
el.addEventListener("aero:autoplayStop", () => el.classList.remove("is-playing"));
createSlider(el, { autoplay: true, loop: true });`),
  },
  resize: {
    group: "Layout",
    type: "{}",
    description:
      "The track or a slide changed size, from a window resize or a CSS variable such as <code>--slides-per-view</code>. Fires before the slider re-measures and moves the slides back into place.",
    useFor: "Hiding anything pinned to where a slide was, before the slider moves it.",
    snippet: recipe(`// A tooltip pinned to a slide would point at the wrong spot once slides move.
const tip = document.querySelector(".slide-tip");
el.addEventListener("aero:resize", () => {
  tip.hidden = true;
});`),
  },
  resized: {
    group: "Layout",
    type: "{}",
    description:
      "The slider has re-measured after a resize and put the active slide back in place.",
    useFor: "Recomputing anything that depends on slide size or position.",
    snippet: recipe(`// Hand the slide width to CSS, e.g. to size captions outside the track.
const setSlideWidth = () => {
  const slide = el.querySelector("[data-aero-slider-index]");
  el.style.setProperty("--slide-width", \`\${slide.offsetWidth}px\`);
};

el.addEventListener("aero:ready", setSlideWidth);
el.addEventListener("aero:resized", setSlideWidth);
createSlider(el);`),
  },
  ready: {
    group: "Lifecycle",
    type: "{}",
    description:
      "<code>createSlider</code> finished setting up. It fires before <code>createSlider</code> returns, so only listeners added beforehand hear it.",
    useFor:
      "Setup that needs the instance when other code creates the slider, such as a framework component or a CMS block.",
    snippet: recipe(`// Add this before the code that calls createSlider runs.
document.addEventListener("aero:ready", (event) => {
  const slider = event.target.aeroSlider;
  const counter = event.target.querySelector(".slide-counter");
  if (counter) counter.textContent = \`\${slider.currentIndex + 1} / \${slider.slideCount}\`;
});`),
  },
  destroy: {
    group: "Lifecycle",
    type: "{}",
    description:
      "<code>destroy()</code> was called. It fires first, while the instance still works, and teardown follows.",
    useFor: "Removing your own listeners and timers that belong to this slider.",
    snippet: recipe(`const slider = createSlider(el);
const listeners = new AbortController();

// Your own listeners for this slider share one signal…
document.addEventListener("keydown", (event) => event.key === "n" && slider.next(), {
  signal: listeners.signal,
});
// …so they all go when it does.
el.addEventListener("aero:destroy", () => listeners.abort(), { once: true });`),
  },
};

export interface EventEntry extends EventDoc {
  key: SliderEvent;
}

export const eventEntryGroups: { title: EventGroup; entries: EventEntry[] }[] = eventGroups.map(
  (title) => ({
    title,
    entries: (Object.entries(events) as [SliderEvent, EventDoc][])
      .filter(([, doc]) => doc.group === title)
      .map(([key, doc]) => ({ key, ...doc })),
  })
);

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
