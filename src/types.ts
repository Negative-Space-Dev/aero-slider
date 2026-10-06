export type SliderAlignment = "left" | "center" | "right";

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
