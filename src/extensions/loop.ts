import { CLONE_ATTR, SLIDE_INDEX_ATTR } from "../attributes.ts";
import type { SliderCore } from "../slider.ts";

const FOCUSABLE =
  "a, area, button, input, select, textarea, iframe, summary, audio[controls], video[controls], embed, object, [contenteditable], [tabindex]";

/** Clones of every slide on both sides, so native scrolling can run past the ends. */
export function loop(core: SliderCore) {
  const { track, config } = core;
  // Clones are made here, where nothing loads: cloning a live lazy image can start its fetch.
  const inertDocument = document.implementation.createHTMLDocument("");

  function cloneOf(slide: HTMLElement): HTMLElement {
    const clone = inertDocument.importNode(slide, true);
    clone.removeAttribute(SLIDE_INDEX_ATTR);
    clone.setAttribute(CLONE_ATTR, "");
    clone.setAttribute("aria-hidden", "true");
    // A clone looks, plays and clicks like its slide but stays out of the tab order, forms and
    // labels; an image map in it is only a picture. The slide itself can be a link (a card). A
    // required control without its name is a group of its own, never filled in: it would block
    // the form it sits in, so a clone is not required either.
    for (const el of [clone, ...clone.querySelectorAll<HTMLElement>("*")]) {
      for (const name of ["id", "name", "for", "form", "usemap", "required"])
        el.removeAttribute(name);
      if (el.matches(FOCUSABLE)) el.tabIndex = -1;
    }
    return clone;
  }

  // A continuous lap travels one full set of slides past wherever it starts, so it needs a whole
  // set of clones beyond the real slides plus a viewport's worth.
  function count(): number {
    const slides = core.slides().length;
    const inView = Math.ceil(core.perView()) + 2;
    return config.autoplay === "continuous" ? slides + inView : Math.max(slides, inView);
  }

  /** Where each copy of slide `index` the track can reach rests. */
  const copiesOf = (index: number) =>
    core
      .snaps()
      .filter(
        (position, domIndex) => core.indexOfDom(domIndex) === index && core.reachable(position)
      );

  return {
    count,
    /** Puts the clones around the slides and returns how many lead them. */
    build(): number {
      const slides = core.slides();
      const before = count();
      // One insertion per side: custom elements in clones upgrade as they go in, and a constructor
      // that measures itself would lay the page out once per insertion.
      const clones = (from: number) =>
        Array.from({ length: before }, (_, i) =>
          cloneOf(slides[(((from + i) % slides.length) + slides.length) % slides.length]!)
        );
      track.prepend(...clones(-before));
      track.append(...clones(0));
      // WebKit never starts loading media that arrived from another document with <source>
      // children. The clone can be the media element itself.
      for (const media of track.querySelectorAll<HTMLMediaElement>("video, audio")) {
        if (media.closest(`[${CLONE_ATTR}]`) && media.networkState === media.NETWORK_EMPTY)
          media.load();
      }
      return before;
    },
    /**
     * Steps queued faster than the track moves can run a lap or more past the reachable clones.
     * Head for the copy of `index` nearest the track in direction `dir` instead; extra laps would
     * only spin past. With no copy left ahead, hop the track a lap back first: the copies look
     * identical, and a lap from the runway's far end stays on it. Mid-move the track sits between
     * slides, where mandatory snapping would pull the hop, so snapping stays off until the move
     * settles.
     */
    headFor(index: number, dir: number): number {
      // No direction (a zero step onto an unreachable copy): the nearest reachable copy will do.
      if (!dir) {
        const position = core.position();
        return copiesOf(index).reduce((a, b) =>
          Math.abs(b - position) < Math.abs(a - position) ? b : a
        );
      }
      const copiesAhead = (position: number) =>
        copiesOf(index).filter((p) => (dir > 0 ? p > position + 1 : p < position - 1));
      let ahead = copiesAhead(core.position());
      if (!ahead.length) {
        core.cancelEase();
        track.style.scrollSnapType = "none";
        core.jumpTo(core.position() - dir * core.lap());
        ahead = copiesAhead(core.position());
      }
      return dir > 0 ? Math.min(...ahead) : Math.max(...ahead);
    },
  };
}

export type Loop = ReturnType<typeof loop>;
