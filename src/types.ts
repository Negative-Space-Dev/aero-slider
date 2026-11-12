export type SliderAlignment = "left" | "center" | "right";

/**
 * How the track comes to rest. `native` uses CSS scroll snapping; `settle` scrolls freely, then
 * eases onto the nearest slide once scrolling ends; `none` leaves the track wherever it stops.
 */
export type SliderSnap = "native" | "settle" | "none";

export interface SliderConfig {
  loop?: boolean;
  /**
   * `true` advances one move every `autoplayInterval`. `"continuous"` drifts the track at
   * `autoplaySpeed` like a ticker; it implies `loop` and `snap: "none"`.
   */
  autoplay?: boolean | "continuous";
  /** Milliseconds between automatic moves, at least 100. */
  autoplayInterval?: number;
  /** Continuous autoplay speed, in pixels per second. 0 or less keeps the track still. */
  autoplaySpeed?: number;
  draggable?: boolean;
  /** Where the active slide rests in the viewport. */
  alignment?: SliderAlignment;
  /** Show at most this many pagination dots, scrolling them iOS-style. 0 = unlimited. */
  maxDots?: number;
  /** Selector for elements inside slides that should not start a mouse drag. */
  noDrag?: string;
  /**
   * Stops advanced per next()/prev() call, a whole number of at least 1. A stop is a distinct
   * resting place: without loop, the slides that clamp to the same spot near an end share one.
   */
  perMove?: number;
  /**
   * `"auto"` (the default) follows the container's computed direction and leaves its `dir`
   * attribute alone. `"ltr"` and `"rtl"` set `dir` on the container. `"ttb"` scrolls vertically.
   */
  direction?: "auto" | "ltr" | "rtl" | "ttb";
  /** How the track comes to rest after scrolling. Defaults to `"native"`. */
  snap?: SliderSnap;
  /**
   * Length of next()/prev()/goTo() scrolls in ms, eased by `scrollEasing`. 0 uses the browser's
   * native smooth scrolling. Either way, prefers-reduced-motion makes every scroll instant.
   */
  scrollDuration?: number;
  /** Maps linear progress 0–1 to eased progress, for `scrollDuration` scrolls. */
  scrollEasing?: (progress: number) => number;
  /** Strings the slider writes for assistive technology. Missing keys use the English defaults. */
  labels?: SliderLabels;
}

/**
 * Text the slider gives screen readers. `{index}` (counting from 1) and `{count}` (the number of
 * slides) are replaced where a key allows them.
 */
export interface SliderLabels {
  /** Role description of the container. Defaults to `"carousel"`. */
  carousel?: string;
  /** Role description of each slide. Defaults to `"slide"`. */
  slide?: string;
  /** Name of each slide, with `{index}` and `{count}`. Defaults to `"{index} of {count}"`. */
  slidePosition?: string;
  /** Name of each pagination dot and thumbnail, with `{index}` and `{count}`. Defaults to `"Go to slide {index}"`. */
  dot?: string;
  /** Name of the pagination group. Defaults to `"Slides"`. */
  pagination?: string;
  /** Name of the autoplay button while autoplay can be paused. Defaults to `"Pause autoplay"`. */
  pause?: string;
  /** Name of the autoplay button while it is paused. Defaults to `"Start autoplay"`. */
  play?: string;
}

export interface GoToOptions {
  /** Jump straight there, with no scroll animation. */
  instant?: boolean;
}

export interface SliderInstance {
  readonly element: HTMLElement;
  readonly currentIndex: number;
  readonly slideCount: number;
  next(): void;
  prev(): void;
  goTo(index: number, options?: GoToOptions): void;
  /** Hold autoplay until resume(); other pauses (hover, focus, drag) still apply on top. */
  pause(): void;
  resume(): void;
  update(config?: SliderConfig): void;
  refresh(): void;
  /** Inserts slides before slide `index`, or at the end. The slide in view stays in view. */
  add(slides: HTMLElement | HTMLElement[], index?: number): void;
  /** Removes slides by index. The slide in view stays in view, or the next one takes its place. */
  remove(index: number | number[]): void;
  destroy(): void;
}

export interface SliderEventMap {
  ready: {};
  slideChange: { index: number };
  dragStart: { index: number };
  dragEnd: { index: number; fromIndex: number };
  autoplayStart: {};
  autoplayStop: {};
  destroy: {};
  resize: {};
  resized: {};
  visible: { index: number };
  hidden: { index: number };
}

export type SliderEvent = keyof SliderEventMap;
export type SliderEventData<E extends SliderEvent = SliderEvent> = SliderEventMap[E];

export type SliderDomEventMap = {
  [E in SliderEvent as `aero:${E}`]: CustomEvent<SliderEventMap[E]>;
};

declare global {
  interface HTMLElement {
    aeroSlider?: SliderInstance;
  }
  interface HTMLElementEventMap extends SliderDomEventMap {}
}
