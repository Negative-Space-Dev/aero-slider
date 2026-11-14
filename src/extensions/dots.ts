import type { SliderCore } from "../slider.ts";

// With maxDots set, the dots sit in a sliding track and only a window of them shows, iOS style.
// The track does the sliding, so a theme is free to restyle and animate the dots themselves.

export function maxDots(core: SliderCore) {
  const { config } = core;
  let dotTrack: HTMLElement | null = null;
  let dotPitch = 0; // distance between neighbouring dots; negative in RTL

  return {
    /** Puts more than maxDots dots in a sliding track; returns what goes in the pagination. */
    wrap(box: HTMLElement, holder: DocumentFragment, dots: HTMLElement[]): Node {
      if (!(config.maxDots > 0 && dots.length > config.maxDots)) return holder;
      dotTrack = document.createElement("div");
      dotTrack.className = "aero-slider__pagination-track";
      dotTrack.append(holder);
      box.classList.add("aero-slider__pagination--windowed");
      return dotTrack;
    },
    clear(box: HTMLElement): void {
      dotTrack?.remove();
      dotTrack = null;
      box.classList.remove("aero-slider__pagination--windowed");
      box.style.removeProperty("--pagination-width");
    },
    measure(box: HTMLElement, dots: HTMLElement[]): void {
      if (!dotTrack) return;
      dotPitch = dots[1]!.offsetLeft - dots[0]!.offsetLeft;
      const width = (config.maxDots - 1) * Math.abs(dotPitch) + dots[0]!.offsetWidth;
      box.style.setProperty("--pagination-width", `${width}px`);
    },
    refresh(dots: HTMLElement[], current: number): void {
      if (!dotTrack) return;
      const count = dots.length;
      const { maxDots } = config;
      const firstShown = Math.max(0, Math.min(current - Math.floor(maxDots / 2), count - maxDots));
      dotTrack.style.setProperty("--track-offset", `${-firstShown * dotPitch}px`);
      const hidden: HTMLElement[] = [];
      dots.forEach((dot, i) => {
        // How far inside the window the dot sits: -1 is outside it, 0 its outermost dot, 1 the next
        // one in. A side of the window with no dots beyond it has no edge.
        const slot = i - firstShown;
        const depth = Math.min(
          firstShown ? slot : 9,
          firstShown < count - maxDots ? maxDots - 1 - slot : 9
        );
        ["hidden", "edge", "near-edge"].forEach((size, at) =>
          dot.classList.toggle(`aero-slider__dot--${size}`, at ? at === depth + 1 : depth < 0)
        );
        if (depth < 0) hidden.push(dot);
        else dot.inert = false;
      });
      // A dot leaving the tab order hands focus to the current one, which must be focusable first:
      // End from the first dot lands on one that was outside the window a moment ago.
      if (hidden.includes(document.activeElement as HTMLElement)) {
        dots[current]!.focus({ preventScroll: true });
      }
      for (const dot of hidden) dot.inert = true;
    },
  };
}

export type DotWindow = ReturnType<typeof maxDots>;
