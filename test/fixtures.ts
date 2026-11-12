import { type Page, expect, test } from "@playwright/test";
import type { SliderConfig, SliderInstance, createSlider, syncThumbnails } from "../src/index.ts";

export { expect, test };
export type { Page };

declare global {
  interface Window {
    createSlider: typeof createSlider;
    syncThumbnails: typeof syncThumbnails;
    /** Instances made by `create`, keyed by element id. */
    sliders: Record<string, SliderInstance>;
  }
}

/** `n` slides labelled `0` to `n - 1`, or with `inner(i)` as each slide's content. */
export const slides = (n: number, inner?: (i: number) => string): string =>
  Array.from({ length: n }, (_, i) => `<div>${inner ? inner(i) : `<div>${i}</div>`}</div>`).join(
    ""
  );

/** Previous and next buttons. */
export const nav = `<button class="aero-slider__nav--prev" aria-label="Previous"></button><button class="aero-slider__nav--next" aria-label="Next"></button>`;

/** A pagination container holding the dot template the library clones per page. */
export const dots = `<div class="aero-slider__pagination"><span class="aero-slider__dot" style="width:10px;height:10px"></span></div>`;

export interface SliderMarkup {
  /** Extra inline CSS on the root, after its 600px width. */
  style?: string;
  /** Extra classes on the root, after `aero-slider`. */
  className?: string;
  /** Include prev and next buttons. Defaults to true. */
  nav?: boolean;
  /** Include pagination dots. Defaults to true. */
  dots?: boolean;
  /** Content of slide `i`. */
  inner?: (i: number) => string;
}

/** One 600px-wide slider with `n` slides and the library's class names. */
export const slider = (id: string, n: number, options: SliderMarkup = {}): string => {
  const { style = "", className = "", inner } = options;
  return `<div id="${id}" class="aero-slider ${className}" style="width:600px;${style}"><div class="aero-slider__viewport" style="position:relative">${options.nav === false ? "" : nav}<div class="aero-slider__track">${slides(n, inner)}</div></div>${options.dots === false ? "" : dots}</div>`;
};

export interface MountOptions {
  /** Attributes for `<html>`, such as `{ dir: "rtl" }`. */
  htmlAttributes?: Record<string, string>;
  /** Extra markup for `<head>`. */
  head?: string;
}

const MOUNT_PATH = "/__mount.html";

/**
 * Loads a page whose body is `html`, with the built stylesheet and library from `dist/`, and
 * waits until `window.createSlider` and `window.syncThumbnails` exist. The document is served
 * from the test server's origin, so relative URLs, lazy images and module imports behave as on
 * a real site.
 */
export async function mount(page: Page, html: string, options: MountOptions = {}): Promise<void> {
  const attributes = Object.entries(options.htmlAttributes ?? {})
    .map(([name, value]) => ` ${name}="${value}"`)
    .join("");
  const document = `<!doctype html><html${attributes}><head><meta charset="utf-8"><link rel="stylesheet" href="/dist/aero-slider.min.css">${options.head ?? ""}</head><body style="margin:0">${html}<script type="module">
import { createSlider, syncThumbnails } from "/dist/aero-slider.min.js";
Object.assign(window, { createSlider, syncThumbnails, sliders: {} });
</script></body></html>`;
  await page.route(MOUNT_PATH, (route) =>
    route.fulfill({ contentType: "text/html", body: document })
  );
  await page.goto(MOUNT_PATH);
  await page.waitForFunction(() => typeof window.createSlider === "function");
}

/**
 * Calls `createSlider` on `#id` and stores the instance as `window.sliders[id]`. `config` crosses
 * into the page as JSON, so function options such as `scrollEasing` need a `page.evaluate`.
 */
export async function create(
  page: Page,
  id: string,
  config?: Omit<SliderConfig, "scrollEasing">
): Promise<void> {
  await page.evaluate(
    ([id, config]) => {
      window.sliders[id] = window.createSlider(document.getElementById(id)!, config);
    },
    [id, config] as const
  );
}

/**
 * Resolves once the track of `#id` has held the same scroll position for several frames and at
 * least 150ms, long enough for a smooth scroll to start and for a loop's clone-to-real jump.
 */
export async function settled(page: Page, id: string): Promise<void> {
  await page.evaluate(async (id) => {
    const track = document.querySelector<HTMLElement>(`#${id} .aero-slider__track`)!;
    const position = () => track.scrollLeft + track.scrollTop;
    let last = position();
    let stillSince = performance.now();
    let stillFrames = 0;
    while (stillFrames < 5 || performance.now() - stillSince < 150) {
      await new Promise(requestAnimationFrame);
      const now = position();
      if (now !== last) {
        last = now;
        stillSince = performance.now();
        stillFrames = 0;
      } else stillFrames++;
    }
  }, id);
}
