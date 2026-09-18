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
  if (!track) return () => {};
  const controller = new AbortController();
  const { signal } = controller;

  // Drag would swallow clicks, and clicks alone drive the strip.
  thumbnails.update({ draggable: false, loop: options.loop ?? true });
  track.style.cursor = "pointer";

  /** Slide index for any track child, loop clones included. */
  const indexOf = (child: Element): number => {
    const own = child.getAttribute(SLIDE_INDEX_ATTR);
    if (own !== null) return Number(own);
    const children = Array.from(track.children);
    const firstReal = children.findIndex((el) => el.hasAttribute(SLIDE_INDEX_ATTR));
    const count = thumbnails.slideCount;
    return (((children.indexOf(child) - firstReal) % count) + count) % count;
  };

  const activate = (index: number): void => {
    for (const child of track.children)
      child.classList.toggle(ACTIVE_CLASS, indexOf(child) === index);
    thumbnails.goTo(index);
  };

  track.addEventListener(
    "click",
    (event) => {
      let el = event.target as Element | null;
      while (el && el.parentElement !== track) el = el.parentElement;
      if (el) primary.goTo(indexOf(el)); // primary's slideChange then activates the thumb
    },
    { signal }
  );
  primary.element.addEventListener(
    "aero:slideChange",
    (event) => activate((event as CustomEvent<{ index: number }>).detail.index),
    { signal }
  );

  activate(primary.currentIndex);
  return () => {
    controller.abort();
    track.style.cursor = "";
    for (const child of track.children) child.classList.remove(ACTIVE_CLASS);
  };
}
