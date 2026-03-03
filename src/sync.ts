import type { SliderInstance } from "./types.ts";

const THUMB_ACTIVE_CLASS = "aero-slider__thumb--active";

function setActiveThumb(
  track: HTMLElement,
  index: number,
  getLogicalIndex: (el: HTMLElement) => number
): void {
  const allSlides = track.querySelectorAll<HTMLElement>(":scope > *");
  allSlides.forEach((el) => {
    const logicalIndex = getLogicalIndex(el);
    el.classList.toggle(THUMB_ACTIVE_CLASS, logicalIndex === index);
  });
}

export interface SyncThumbnailsOptions {
  /** Loop mode for the thumbnail slider. Defaults to true for backward compatibility. */
  loop?: boolean;
}

/**
 * Syncs a primary slider with a thumbnail slider. Clicking a thumbnail navigates
 * the primary to that slide. When the primary changes (drag, arrows, etc.), the
 * thumbnail slider scrolls to keep the active thumbnail in view and adds
 * `aero-slider__thumb--active` to the active thumbnail.
 *
 * Both sliders must have the same number of slides. Call the returned function
 * to teardown and remove all listeners.
 */
export function syncThumbnails(
  primary: SliderInstance,
  thumbnail: SliderInstance,
  options?: SyncThumbnailsOptions
): () => void {
  const track = thumbnail.element.querySelector<HTMLElement>(".aero-slider__track");
  if (!track) return () => {};
  const trackEl = track;

  /* Disable drag on thumbnails so clicks register reliably (pointer capture from
   * drag would otherwise intercept and suppress click events). Loop defaults to
   * true for backward compatibility. We intentionally do NOT force centered mode
   * here—the thumbnail slider's scroll position should not affect navigation;
   * only explicit clicks control which slide is active. */
  const loop = options?.loop ?? true;
  thumbnail.update({ draggable: false, loop });

  /* Get original slides for getLogicalIndex and clone layout. */
  const slides = Array.from(trackEl.children).filter((el) =>
    el.hasAttribute("data-aero-slider-index")
  ) as HTMLElement[];
  slides.sort(
    (a, b) =>
      Number(a.getAttribute("data-aero-slider-index")) -
      Number(b.getAttribute("data-aero-slider-index"))
  );
  const slideCount = slides.length;
  const firstOriginalIndex = Array.from(trackEl.children).indexOf(slides[0] ?? trackEl);
  const handlers: Array<{ el: HTMLElement; fn: () => void }> = [];

  /** Get logical slide index (0..slideCount-1) for any track child, including loop clones. */
  function getLogicalIndex(el: HTMLElement): number {
    const idxAttr = el.getAttribute("data-aero-slider-index");
    if (idxAttr !== null) return Number(idxAttr);
    const domIndex = Array.from(trackEl.children).indexOf(el);
    if (domIndex < firstOriginalIndex) {
      return domIndex % slideCount;
    }
    return (domIndex - firstOriginalIndex - slideCount) % slideCount;
  }

  /** Source of truth for active slide; updates on click or primary slideChange. */
  let activeIndex = primary.currentIndex;

  function setActive(index: number): void {
    activeIndex = index;
    setActiveThumb(trackEl, activeIndex, getLogicalIndex);
  }

  /** Navigate both sliders to the given index (called on thumbnail click). */
  function navigate(index: number): void {
    setActive(index);
    thumbnail.goTo(index);
    primary.goTo(index);
  }

  /** Sync thumbnail to match primary (called on primary slideChange). */
  function syncFromPrimary(index: number): void {
    setActive(index);
    thumbnail.goTo(index);
  }

  /* Thumbnail click handlers: clicking a thumbnail navigates both sliders. */
  Array.from(trackEl.children).forEach((el) => {
    const slide = el as HTMLElement;
    const handler = (): void => {
      const i = getLogicalIndex(slide);
      navigate(i);
    };
    slide.addEventListener("click", handler);
    slide.style.cursor = "pointer";
    handlers.push({ el: slide, fn: handler });
  });

  /* Primary slideChange: sync thumbnail to follow primary.
   * We trust the primary slider's index as the source of truth. */
  const onPrimarySlideChange = (data: { index: number }): void => {
    if (data.index === activeIndex) return;
    syncFromPrimary(data.index);
  };
  primary.on("slideChange", onPrimarySlideChange);

  /* NOTE: We intentionally do NOT listen to thumbnail's slideChange event.
   * The thumbnail's scroll-derived index can differ from the clicked index
   * due to scroll-snap settling, especially with loop mode or when slides
   * are near the edges. Only explicit clicks should control navigation. */

  syncFromPrimary(primary.currentIndex);

  return (): void => {
    handlers.forEach(({ el, fn }) => el.removeEventListener("click", fn));
    trackEl.querySelectorAll(`:scope > *`).forEach((el) => el.classList.remove(THUMB_ACTIVE_CLASS));
    primary.off("slideChange", onPrimarySlideChange);
  };
}
