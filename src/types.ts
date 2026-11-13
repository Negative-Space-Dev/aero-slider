export type SliderAlignment = "start" | "center" | "end";

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
  /**
   * Where the active slide rests in the viewport. The values are logical: `"start"` is the left
   * edge in a left-to-right slider, the right edge in a right-to-left one and the top edge in a
   * vertical one, and `"end"` is the opposite edge. Defaults to `"center"`.
   */
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
   * Scroll top to bottom instead of along the text direction. Horizontal sliders follow the
   * container's computed direction, so `dir="rtl"` on it or an ancestor makes one right-to-left.
   */
  vertical?: boolean;
  /** How the track comes to rest after scrolling. Defaults to `"native"`. */
  snap?: SliderSnap;
  /**
   * Length of next()/prev()/goTo() scrolls in ms, eased by `scrollEasing`. 0 uses the browser's
   * native smooth scrolling. Either way, prefers-reduced-motion makes every scroll instant.
   */
  scrollDuration?: number;
  /** Maps linear progress 0–1 to eased progress, for `scrollDuration` scrolls. */
  scrollEasing?: (progress: number) => number;
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
