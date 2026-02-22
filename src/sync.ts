import type { SliderInstance } from "./types.ts";

const THUMB_ACTIVE_CLASS = "aero-slider__thumb--active";
const THUMB_UPDATE_DEBOUNCE_MS = 50;
const THUMB_ARRIVAL_STABLE_MS = 200;

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

/**
 * Scrolls the thumbnail track to center the given slide index in the viewport.
 * In loop mode, picks the instance (original or clone) closest to current scroll
 * to avoid jumping backward when advancing past the end.
 */
function centerThumbnail(
  track: HTMLElement,
  targetIndex: number,
  getLogicalIndex: (el: HTMLElement) => number
): void {
  const viewportWidth = track.clientWidth;
  const currentScroll = track.scrollLeft;

  // Find all elements with the target logical index (original + clones in loop mode)
  const candidates = Array.from(track.children).filter(
    (el) => getLogicalIndex(el as HTMLElement) === targetIndex
  ) as HTMLElement[];

  if (candidates.length === 0) return;

  // Pick the instance whose center-scroll is closest to current scroll
  let bestScroll = 0;
  let bestDist = Infinity;

  for (const slide of candidates) {
    const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
    const targetScroll = slideCenter - viewportWidth / 2;
    const maxScroll = track.scrollWidth - viewportWidth;
    const clamped = Math.max(0, Math.min(targetScroll, maxScroll));
    const dist = Math.abs(clamped - currentScroll);

    if (dist < bestDist) {
      bestDist = dist;
      bestScroll = clamped;
    }
  }

  track.scrollTo({ left: bestScroll, behavior: "smooth" });
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

  /* Set thumbnail loop to match primary (or explicit option). Disable drag so clicks
   * register; pointer capture from drag would otherwise intercept and suppress
   * the click event. */
  const loop = options?.loop ?? true;
  thumbnail.update({ draggable: false, loop });

  /* Get original slides for centerThumbnail and to compute clone layout. */
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

  /* When user clicks a thumbnail, they've already scrolled to see it. Ignore
   * slideChange until the main slider has reached and stabilized on that slide
   * (scroll position can oscillate 10/11 near the end; only clear once stable). */
  let thumbClickTarget: number | null = null;
  let arrivalStableTimer: ReturnType<typeof setTimeout> | null = null;

  Array.from(trackEl.children).forEach((el) => {
    const slide = el as HTMLElement;
    const handler = (): void => {
      const i = getLogicalIndex(slide);
      thumbClickTarget = i;
      setActiveThumb(trackEl, i, getLogicalIndex);
      primary.goTo(i);
    };
    slide.addEventListener("click", handler);
    slide.style.cursor = "pointer";
    handlers.push({ el: slide, fn: handler });
  });

  let thumbUpdateTimer: ReturnType<typeof setTimeout> | null = null;

  const onSlideChange = (data: { index: number }): void => {
    if (thumbClickTarget !== null) {
      if (data.index === thumbClickTarget) {
        /* Main slider has reached the clicked slide. Wait for it to stabilize
         * (no oscillation back to previous index) before clearing. */
        if (arrivalStableTimer !== null) clearTimeout(arrivalStableTimer);
        arrivalStableTimer = setTimeout(() => {
          arrivalStableTimer = null;
          thumbClickTarget = null;
        }, THUMB_ARRIVAL_STABLE_MS);
      } else {
        if (arrivalStableTimer !== null) {
          clearTimeout(arrivalStableTimer);
          arrivalStableTimer = null;
        }
      }
      return;
    }

    if (thumbUpdateTimer !== null) {
      clearTimeout(thumbUpdateTimer);
    }

    thumbUpdateTimer = setTimeout(() => {
      thumbUpdateTimer = null;
      setActiveThumb(trackEl, data.index, getLogicalIndex);
      centerThumbnail(trackEl, data.index, getLogicalIndex);
    }, THUMB_UPDATE_DEBOUNCE_MS);
  };
  primary.on("slideChange", onSlideChange);

  setActiveThumb(trackEl, primary.currentIndex, getLogicalIndex);
  centerThumbnail(trackEl, primary.currentIndex, getLogicalIndex);

  return (): void => {
    if (thumbUpdateTimer !== null) clearTimeout(thumbUpdateTimer);
    if (arrivalStableTimer !== null) clearTimeout(arrivalStableTimer);
    thumbClickTarget = null;
    handlers.forEach(({ el, fn }) => el.removeEventListener("click", fn));
    trackEl.querySelectorAll(`:scope > *`).forEach((el) => el.classList.remove(THUMB_ACTIVE_CLASS));
    primary.off("slideChange", onSlideChange);
  };
}
