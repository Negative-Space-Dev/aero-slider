import type { SliderInstance } from "./types.ts";
import { SLIDE_INDEX_ATTR, cores } from "./slider.ts";
import { pressable } from "./features.ts";

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
  const core = cores.get(thumbnails);
  if (!track || !core) return () => {};
  const controller = new AbortController();
  const { signal } = controller;

  // Thumbnails become buttons. Drag would swallow clicks, and clicks alone drive the strip.
  core.picker = true;
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
    for (const child of track.children) {
      const active = indexOf(child) === index;
      child.classList.toggle(ACTIVE_CLASS, active);
      if (child.hasAttribute(SLIDE_INDEX_ATTR))
        core.attr(child, "aria-current", active ? "true" : null);
    }
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
    (event) => {
      // A slider nested inside a primary slide bubbles its own changes through here.
      if (event.target === primary.element) activate(event.detail.index);
    },
    { signal }
  );
  // Thumbnails the author marked up as buttons count too, not only the ones made into buttons here.
  pressable(
    track,
    (target) => target.hasAttribute(SLIDE_INDEX_ATTR) && target.getAttribute("role") === "button",
    signal
  );

  activate(primary.currentIndex);
  return () => {
    controller.abort();
    track.style.cursor = "";
    if (!track.getAttribute("style")) track.removeAttribute("style");
    for (const child of track.children) {
      child.classList.remove(ACTIVE_CLASS);
      core.attr(child, "aria-current", null);
    }
    core.picker = false;
    thumbnails.refresh();
  };
}
