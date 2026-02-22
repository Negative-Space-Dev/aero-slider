export interface SliderConfig {
  loop?: boolean;
  autoplay?: boolean;
  autoplayInterval?: number;
  draggable?: boolean;
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
  on(event: SliderEvent, callback: SliderEventCallback): void;
  off(event: SliderEvent, callback: SliderEventCallback): void;
  readonly currentIndex: number;
  readonly slideCount: number;
}

export interface AeroSliderElement extends HTMLElement {
  aeroSlider?: SliderInstance;
}

export type SliderEvent =
  | "slideChange"
  | "dragStart"
  | "dragEnd"
  | "autoplayStart"
  | "autoplayStop"
  | "ready"
  | "destroy"
  | "resize"
  | "resized"
  | "visible"
  | "hidden";

/** Event payload. dragEnd includes fromIndex (slide index at drag start). */
export type SliderEventData = { index: number; fromIndex?: number };
export type SliderEventCallback = (data: SliderEventData) => void;

export interface SliderState {
  currentIndex: number;
  isDragging: boolean;
  isDestroyed: boolean;
  loopModeActive: boolean;
  isProgrammaticScroll: boolean;
  slideWidthPx: number;
}

export interface SliderContext {
  container: HTMLElement;
  track: HTMLElement;
  slides: HTMLElement[];
  slideCount: number;
  config: SliderConfigFull;
  state: SliderState;
  listeners: Map<SliderEvent, Set<SliderEventCallback>>;
  emit(event: SliderEvent, data: SliderEventData): void;
  getSlideSize(): number;
  recalcSlideMetrics(): void;
  normalizeIndex(index: number): number;
  getMaxIndex(): number;
  getEffectivePerMove(): number;
  isLoopEnabled(): boolean;
  isFractionalView(): boolean;
  isVertical(): boolean;
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
