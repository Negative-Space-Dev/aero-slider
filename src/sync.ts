import type { SliderInstance } from "./types.ts";

const THUMB_ACTIVE_CLASS = "aero-slider__thumb--active";
const THUMB_UPDATE_DEBOUNCE_MS = 250;
const THUMB_ARRIVAL_STABLE_MS = 200;

function setActiveThumb(slides: HTMLElement[], index: number): void {
  slides.forEach((el, i) => {
    el.classList.toggle(THUMB_ACTIVE_CLASS, i === index);
  });
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
): () => void {
  const track = thumbnail.element.querySelector<HTMLElement>(".aero-slider__track");
  if (!track) return () => {};

  /* Disable drag on thumbnail slider so clicks register; pointer capture from drag
   * would otherwise intercept and suppress the click event. */
  thumbnail.update({ draggable: false });

  const slides = Array.from(track.children) as HTMLElement[];
  const handlers: Array<{ el: HTMLElement; fn: () => void }> = [];

  /* When user clicks a thumbnail, they've already scrolled to see it. Ignore
   * slideChange until the main slider has reached and stabilized on that slide
   * (scroll position can oscillate 10/11 near the end; only clear once stable). */
  let thumbClickTarget: number | null = null;
  let arrivalStableTimer: ReturnType<typeof setTimeout> | null = null;

  slides.forEach((slide, i) => {
    const handler = (): void => {
      thumbClickTarget = i;
      setActiveThumb(slides, i);
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
    if (thumbUpdateTimer !== null) clearTimeout(thumbUpdateTimer);
    thumbUpdateTimer = setTimeout(() => {
      thumbUpdateTimer = null;
      setActiveThumb(slides, data.index);
      thumbnail.goTo(data.index);
    }, THUMB_UPDATE_DEBOUNCE_MS);
  };
  primary.on("slideChange", onSlideChange);

  setActiveThumb(slides, primary.currentIndex);
  thumbnail.goTo(primary.currentIndex);

  return (): void => {
    if (thumbUpdateTimer !== null) clearTimeout(thumbUpdateTimer);
    if (arrivalStableTimer !== null) clearTimeout(arrivalStableTimer);
    thumbClickTarget = null;
    handlers.forEach(({ el, fn }) => el.removeEventListener("click", fn));
    slides.forEach((el) => el.classList.remove(THUMB_ACTIVE_CLASS));
    primary.off("slideChange", onSlideChange);
  };
}
