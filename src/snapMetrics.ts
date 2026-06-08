import type { SliderAlignment } from "./types.ts";
import { resolveCssLength } from "./layoutMetrics.ts";

export interface ScrollPadding {
  start: number;
  end: number;
}

/** Read computed scroll-padding in pixels (accounts for breakout mode). */
export function readScrollPadding(track: HTMLElement, vertical: boolean): ScrollPadding {
  const styles = getComputedStyle(track);
  const viewport = vertical ? track.clientHeight : track.clientWidth;

  if (vertical) {
    return {
      start: resolveCssLength(
        styles.scrollPaddingBlockStart || styles.scrollPaddingTop || "0",
        track,
        viewport
      ),
      end: resolveCssLength(
        styles.scrollPaddingBlockEnd || styles.scrollPaddingBottom || "0",
        track,
        viewport
      ),
    };
  }

  return {
    start: resolveCssLength(
      styles.scrollPaddingInlineStart || styles.scrollPaddingLeft || "0",
      track,
      viewport
    ),
    end: resolveCssLength(
      styles.scrollPaddingInlineEnd || styles.scrollPaddingRight || "0",
      track,
      viewport
    ),
  };
}

function getSlideStart(slide: HTMLElement, track: HTMLElement, vertical: boolean): number {
  if (slide.parentElement === track) {
    return vertical ? slide.offsetTop : slide.offsetLeft;
  }

  const trackRect = track.getBoundingClientRect();
  const slideRect = slide.getBoundingClientRect();
  const currentScroll = vertical ? track.scrollTop : track.scrollLeft;

  return (
    currentScroll +
    (vertical ? slideRect.top - trackRect.top : slideRect.left - trackRect.left)
  );
}

/**
 * Scroll offset that aligns `slide` to the same snap point CSS scroll-snap would use.
 * Matches scroll-snap-align + scroll-padding on the track.
 */
export function measureSnapScrollPos(
  slide: HTMLElement,
  track: HTMLElement,
  alignment: SliderAlignment,
  vertical: boolean
): number {
  const padding = readScrollPadding(track, vertical);
  const viewport = vertical ? track.clientHeight : track.clientWidth;
  const slideStart = getSlideStart(slide, track, vertical);
  const slideSize = vertical ? slide.offsetHeight : slide.offsetWidth;

  if (alignment === "center") {
    const snapCenter = padding.start + (viewport - padding.start - padding.end) / 2;
    return slideStart + slideSize / 2 - snapCenter;
  }

  if (alignment === "right") {
    return slideStart + slideSize - viewport + padding.end;
  }

  return slideStart - padding.start;
}
