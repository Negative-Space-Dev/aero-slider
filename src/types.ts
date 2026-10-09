export type SliderAlignment = "left" | "center" | "right";

/**
 * How the track comes to rest. `native` uses CSS scroll snapping; `settle` scrolls freely, then
 * eases onto the nearest slide once scrolling ends; `none` leaves the track wherever it stops.
 */
export type SliderSnap = "native" | "settle" | "none";

export interface SliderConfig {
  loop?: boolean;
  autoplay?: boolean;
  autoplayInterval?: number;
  draggable?: boolean;
  /** Where the active slide rests in the viewport. */
  alignment?: SliderAlignment;
  /** Show at most this many pagination dots, scrolling them iOS-style. 0 = unlimited. */
  maxDots?: number;
  /** Selector for elements inside slides that should not start a mouse drag. */
  noDrag?: string;
  /** Slides advanced per next()/prev() call. */
  perMove?: number;
  direction?: "ltr" | "rtl" | "ttb";
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
  add(slides: HTMLElement | HTMLElement[], index?: number): void;
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

declare global {
  interface HTMLElement {
    aeroSlider?: SliderInstance;
  }
}
