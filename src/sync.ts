import type { SliderInstance } from "./types.ts";
import { SLIDE_INDEX_ATTR } from "./slider.ts";

const ACTIVE_CLASS = "aero-slider__thumb--active";

export interface SyncThumbnailsOptions {
  /** Loop the thumbnail strip. Defaults to true. */
  loop?: boolean;
}

/**
 * Links a thumbnail slider to a primary one: clicking a thumbnail navigates the
 * primary, and the strip follows the primary's active slide. Returns a teardown.
 */
export function syncThumbnails(
  primary: SliderInstance,
  thumbnails: SliderInstance,
  options: SyncThumbnailsOptions = {}
): () => void {
  const track = thumbnails.element.querySelector<HTMLElement>(".aero-slider__track");
  const row = track?.querySelector<HTMLElement>(":scope > .aero-slider__slides");
  if (!track || !row) return () => {};
  const controller = new AbortController();
  const { signal } = controller;

  thumbnails.update({ loop: options.loop ?? true });
  // A thumbnail is a click target, so the strip shows a pointer rather than a grab hand.
  // Dragging the strip still shows the grabbing hand.
  track.style.cursor = "pointer";
  const showCursor = (cursor: string) => (event: Event) => {
    if (event.target === thumbnails.element) track.style.cursor = cursor;
  };
  thumbnails.element.addEventListener("aero:dragStart", showCursor("grabbing"), { signal });
  thumbnails.element.addEventListener("aero:dragEnd", showCursor("pointer"), { signal });

  /** Slide index for any child of the slides row, loop clones included. */
  const indexOf = (child: Element): number => {
    const own = child.getAttribute(SLIDE_INDEX_ATTR);
    if (own !== null) return Number(own);
    const children = Array.from(row.children);
    const firstReal = children.findIndex((el) => el.hasAttribute(SLIDE_INDEX_ATTR));
    const count = thumbnails.slideCount;
    return (((children.indexOf(child) - firstReal) % count) + count) % count;
  };

  /** Marks thumbnail `index` as the current one, or none of them. Clones stay unmarked. */
  const mark = (index: number): void => {
    for (const child of row.children) {
      const active = indexOf(child) === index;
      child.classList.toggle(ACTIVE_CLASS, active);
      if (active && child.hasAttribute(SLIDE_INDEX_ATTR))
        child.setAttribute("aria-current", "true");
      else child.removeAttribute("aria-current");
    }
  };
  const activate = (index: number): void => {
    mark(index);
    thumbnails.goTo(index);
  };

  row.addEventListener(
    "click",
    (event) => {
      let el = event.target as Element | null;
      while (el && el.parentElement !== row) el = el.parentElement;
      if (el) primary.goTo(indexOf(el)); // primary's slideChange then activates the thumb
    },
    { signal }
  );
  primary.element.addEventListener(
    "aero:slideChange",
    (event) => {
      // A slider nested inside a primary slide bubbles its own changes through here.
      if (event.target === primary.element) activate(event.detail.index);
    },
    { signal }
  );

  // refresh() renumbers the slides without a slideChange when the index stays put, and the
  // thumbnail that now holds that index may be a new element.
  const renumbered = new MutationObserver(() => mark(primary.currentIndex));
  renumbered.observe(row, { subtree: true, attributeFilter: [SLIDE_INDEX_ATTR] });

  const teardown = (): void => {
    controller.abort();
    renumbered.disconnect();
    track.style.cursor = "";
    if (!track.getAttribute("style")) track.removeAttribute("style");
    mark(-1);
  };
  // Destroying the strip without calling the teardown still takes the marks back.
  // A slider nested in a thumbnail bubbles its own destroy through here.
  thumbnails.element.addEventListener(
    "aero:destroy",
    (event) => event.target === thumbnails.element && teardown(),
    { signal }
  );

  activate(primary.currentIndex);
  return teardown;
}
