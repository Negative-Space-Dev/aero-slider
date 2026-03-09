export type SliderAlignment = "left" | "center" | "right";

export interface SliderConfig {
  loop?: boolean;
  autoplay?: boolean;
  autoplayInterval?: number;
  draggable?: boolean;
  /** Align the active slide to the left, center, or right when possible. */
  alignment?: SliderAlignment;
  /** Maximum number of pagination dots to show. Beyond this, edge indicators are used. */
  maxDots?: number;
  noDrag?: string;
  perMove?: number;
  direction?: "ltr" | "rtl" | "ttb";
}

/** Layout options read from CSS custom properties; not passed via JS config. */
export interface SliderLayoutConfig {
  slidesPerView: number;
  gap: number;
  aspectRatio: string;
}

export type SliderConfigFull = Required<SliderConfig> & SliderLayoutConfig;

export interface SliderInstance {
  readonly element: HTMLElement;
  next(): void;
  prev(): void;
  goTo(index: number): void;
  destroy(): void;
  update(config?: SliderConfig): void;
  refresh(): void;
  add(slides: HTMLElement | HTMLElement[], index?: number): void;
  remove(index: number | number[]): void;
  readonly currentIndex: number;
  readonly slideCount: number;
}

export interface AeroSliderElement extends HTMLElement {
  aeroSlider?: SliderInstance;
}

export type SliderEvent =
  | "ready"
  | "slideChange"
  | "dragStart"
  | "dragEnd"
  | "autoplayStart"
  | "autoplayStop"
  | "destroy"
  | "resize"
  | "resized"
  | "visible"
  | "hidden";

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

export type SliderEventData<E extends SliderEvent = SliderEvent> = SliderEventMap[E];

export interface SliderState {
  currentIndex: number;
  isDragging: boolean;
  isDestroyed: boolean;
  loopModeActive: boolean;
  isProgrammaticScroll: boolean;
  /** Suppress slideChange emit on scroll settle (goTo/drag already emitted). */
  suppressSettleEmit: boolean;
  slideWidthPx: number;
}

export interface SliderContext {
  container: HTMLElement;
  track: HTMLElement;
  slides: HTMLElement[];
  slideCount: number;
  config: SliderConfigFull;
  state: SliderState;
  emit<E extends SliderEvent>(event: E, data: SliderEventData<E>): void;
  getSlideSize(): number;
  recalcSlideMetrics(): void;
  normalizeIndex(index: number): number;
  getMaxIndex(): number;
  getEffectivePerMove(): number;
  isLoopEnabled(): boolean;
  isFractionalView(): boolean;
  isVertical(): boolean;
  getAlignmentOffset(): number;
  getScrollPos(): number;
  setScrollPos(pos: number): void;
  scrollToPos(pos: number, behavior?: ScrollBehavior): void;
  getScrollPosForIndex(index: number): number;
  getIndexFromScrollPos(scrollPos: number): number;
  refreshPagination(): void;
  refreshNavState(): void;
  applySnapAlignment(): void;
}

declare global {
  interface HTMLElement {
    aeroSlider?: SliderInstance;
  }
}
