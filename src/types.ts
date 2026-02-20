export interface SliderConfig {
  loop?: boolean;
  autoplay?: boolean;
  autoplayInterval?: number;
  pagination?: boolean;
  navigation?: boolean;
  draggable?: boolean;
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
  | "autoplayStop";

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
  getSlideWidth(): number;
  recalcSlideMetrics(): void;
  normalizeIndex(index: number): number;
  getMaxIndex(): number;
  isLoopEnabled(): boolean;
  isFractionalView(): boolean;
  getScrollLeftForIndex(index: number): number;
  getIndexFromScrollLeft(scrollLeft: number): number;
  refreshPagination(): void;
  refreshNavState(): void;
  applySnapAlignment(): void;
}

declare global {
  interface HTMLElement {
    aeroSlider?: SliderInstance;
  }
}
