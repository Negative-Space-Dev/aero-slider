import type { SliderInstance } from "./types.ts";
import { FOCUSABLE, SLIDE_INDEX_ATTR } from "./attributes.ts";

const ACTIVE_CLASS = "aero-slider__thumb--active";

export interface SyncThumbnailsOptions {
  /** Loop the thumbnail strip. Defaults to true. */
  loop?: boolean;
}

/**
 * Links a thumbnail slider to a primary one: clicking a thumbnail navigates the
 * primary, and the strip follows the primary's active slide. A thumbnail that isn't a control
 * of its own becomes a button: a tab stop that Enter and Space press. Returns a teardown.
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

  thumbnails.update({ loop: options.loop ?? true });
  // A thumbnail is a click target, so the strip shows a pointer rather than a grab hand.
  // Dragging the strip still shows the grabbing hand.
  track.style.cursor = "pointer";
  const showCursor = (cursor: string) => (event: Event) => {
    if (event.target === thumbnails.element) track.style.cursor = cursor;
  };
  thumbnails.element.addEventListener("aero:dragStart", showCursor("grabbing"), { signal });
  thumbnails.element.addEventListener("aero:dragEnd", showCursor("pointer"), { signal });

  /** Slide index for any track child, loop clones included. */
  const indexOf = (child: Element): number => {
    const own = child.getAttribute(SLIDE_INDEX_ATTR);
    if (own !== null) return Number(own);
    const children = Array.from(track.children);
    const firstReal = children.findIndex((el) => el.hasAttribute(SLIDE_INDEX_ATTR));
    const count = thumbnails.slideCount;
    return (((children.indexOf(child) - firstReal) % count) + count) % count;
  };

  /** Marks thumbnail `index` as the current one, or none of them. Clones stay unmarked. */
  const mark = (index: number): void => {
    for (const child of track.children) {
      const active = indexOf(child) === index;
      child.classList.toggle(ACTIVE_CLASS, active);
      if (active && child.hasAttribute(SLIDE_INDEX_ATTR))
        child.setAttribute("aria-current", "true");
      else child.removeAttribute("aria-current");
    }
  };
  /** Each thumbnail made a button, with its role and aria-label from before. Clones are never
   * in it. */
  const buttons = new Map<HTMLElement, [role: string | null, label: string | null]>();
  const put = (el: Element, name: string, value: string | null): void =>
    value === null ? el.removeAttribute(name) : el.setAttribute(name, value);
  const restore = (el: HTMLElement): void => {
    const [role, label] = buttons.get(el)!;
    el.removeAttribute("tabindex"); // it had none: FOCUSABLE covers [tabindex]
    put(el, "role", role);
    put(el, "aria-label", label);
    buttons.delete(el);
  };
  /** Whether `el` names itself, given the aria-label it had before it was made a button. */
  const named = (el: HTMLElement, label: string | null): boolean =>
    !!(
      label?.trim() ||
      el.title.trim() ||
      el.textContent!.trim() ||
      [el, ...el.querySelectorAll("img")].some((img) => (img as HTMLImageElement).alt?.trim()) ||
      el
        .getAttribute("aria-labelledby")
        ?.split(/\s+/)
        .some((id) => document.getElementById(id)?.textContent!.trim())
    );
  /** Makes each real thumbnail without a control of its own a named button, and lets go of any
   * that left the strip. Each rebuild checks the name again and renumbers the one it gave. */
  const enhance = (): void => {
    for (const el of buttons.keys()) if (el.parentElement !== track) restore(el);
    for (const el of track.querySelectorAll<HTMLElement>(`:scope > [${SLIDE_INDEX_ATTR}]`)) {
      if (!buttons.has(el)) {
        if (el.matches(FOCUSABLE) || el.querySelector(FOCUSABLE)) continue; // a link or a button
        buttons.set(el, [el.getAttribute("role"), el.getAttribute("aria-label")]);
        el.tabIndex = 0;
        el.setAttribute("role", "button");
      }
      const label = buttons.get(el)![1];
      put(
        el,
        "aria-label",
        named(el, label) ? label : `Go to slide ${+el.getAttribute(SLIDE_INDEX_ATTR)! + 1}`
      );
    }
  };

  const activate = (index: number): void => {
    mark(index);
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
  track.addEventListener(
    "keydown",
    (event) => {
      const el = event.target as HTMLElement;
      if ((event.key === "Enter" || event.key === " ") && buttons.has(el)) {
        event.preventDefault(); // Space would scroll the page
        el.click(); // through the click handler above
      }
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

  // refresh() and update() renumber the slides without a slideChange when the index stays put, and
  // the thumbnail that now holds that index may be a new element, not yet a button.
  const renumbered = new MutationObserver(() => {
    enhance();
    mark(primary.currentIndex);
  });
  renumbered.observe(track, { subtree: true, attributeFilter: [SLIDE_INDEX_ATTR] });

  const teardown = (): void => {
    controller.abort();
    renumbered.disconnect();
    track.style.cursor = "";
    if (!track.getAttribute("style")) track.removeAttribute("style");
    mark(-1);
    for (const el of buttons.keys()) restore(el);
  };
  // Destroying the strip without calling the teardown still takes the marks back.
  // A slider nested in a thumbnail bubbles its own destroy through here.
  thumbnails.element.addEventListener(
    "aero:destroy",
    (event) => event.target === thumbnails.element && teardown(),
    { signal }
  );

  enhance();
  activate(primary.currentIndex);
  return teardown;
}
