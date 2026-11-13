import { type Page, expect, test } from "@playwright/test";
import type {
  SliderConfig,
  SliderEvent,
  SliderInstance,
  createSlider,
  syncThumbnails,
} from "../src/index.ts";

export { expect, test };
export type { Page };

declare global {
  interface Window {
    createSlider: typeof createSlider;
    syncThumbnails: typeof syncThumbnails;
    /** Instances made by `create`, keyed by element id. */
    sliders: Record<string, SliderInstance>;
    /** Samples from the last `recordScroll`. */
    scrollRecording?: Promise<number[]>;
    /** Logs from `recordEvents`, keyed by element id. */
    eventLog: Record<string, string[]>;
    /** Longest gap between two animation frames since `mount`, in ms. Set under `onSteadyFrames`. */
    longestFrame?: number;
    /** Starts `longestFrame` over. */
    resetFrames?: () => void;
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
window.resetFrames?.();
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

const framesWatched = new WeakSet<Page>();

/** A frame gap this long, six frames at 60Hz, means the browser was starved while a test ran. */
const STARVED_MS = 100;

/**
 * Runs `body`, a whole scenario from `mount` to its assertions, and runs it again, up to three
 * times, if it failed while the browser was dropping frames. A test that counts the frames of an
 * animation measures the machine and not the library when the frames come 100ms apart. A failure
 * on steady frames fails at once.
 */
export async function onSteadyFrames(page: Page, body: () => Promise<void>): Promise<void> {
  if (!framesWatched.has(page)) {
    framesWatched.add(page);
    await page.addInitScript(() => {
      let last = performance.now();
      window.longestFrame = 0;
      window.resetFrames = () => {
        last = performance.now();
        window.longestFrame = 0;
      };
      const tick = (): void => {
        const now = performance.now();
        window.longestFrame = Math.max(window.longestFrame!, now - last);
        last = now;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
  for (let attempt = 1; ; attempt++) {
    try {
      return await body();
    } catch (error) {
      const longest = await page.evaluate(() => window.longestFrame ?? 0).catch(() => 0);
      if (attempt === 3 || longest < STARVED_MS) throw error;
    }
  }
}

/** Fails each test in the calling spec file that throws an uncaught error in the page. */
export function failOnPageErrors(): void {
  let errors: string[] = [];
  test.beforeEach(({ page }) => {
    errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
  });
  test.afterEach(() => expect(errors).toEqual([]));
}

/** `#id`'s current index and its track's scroll offset (scrollLeft + scrollTop). */
export const state = (page: Page, id: string): Promise<{ index: number; position: number }> =>
  page.evaluate((id) => {
    const track = document.querySelector<HTMLElement>(`#${id} .aero-slider__track`)!;
    return {
      index: window.sliders[id]!.currentIndex,
      position: track.scrollLeft + track.scrollTop,
    };
  }, id);

/** Resolves after the page's next animation frame. */
export const nextFrame = (page: Page): Promise<void> =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

/**
 * Starts recording the scroll offset of `#id`'s track on every animation frame for `ms`, and
 * resolves once recording runs. Await the returned function for the samples, so a move started in
 * between is recorded from its first frame.
 */
export async function recordScroll(
  page: Page,
  id: string,
  ms: number
): Promise<() => Promise<number[]>> {
  await page.evaluate(
    ([id, ms]) => {
      const track = document.querySelector<HTMLElement>(`#${id} .aero-slider__track`)!;
      const end = performance.now() + ms;
      window.scrollRecording = (async () => {
        const samples: number[] = [];
        while (performance.now() < end) {
          await new Promise(requestAnimationFrame);
          samples.push(track.scrollLeft + track.scrollTop);
        }
        return samples;
      })();
    },
    [id, ms] as const
  );
  return () => page.evaluate(() => window.scrollRecording!);
}

/**
 * Starts logging the `aero:` events in `names` that `#id` dispatches itself, ignoring ones that
 * bubble up from a nested slider. Each entry is the event name followed by its `index`, if it has
 * one: `"slideChange2"`, `"autoplayStart"`. Await the returned function for the log so far.
 */
export async function recordEvents(
  page: Page,
  id: string,
  names: SliderEvent[]
): Promise<() => Promise<string[]>> {
  await page.evaluate(
    ([id, names]) => {
      const el = document.getElementById(id)!;
      const log: string[] = [];
      (window.eventLog ??= {})[id] = log;
      for (const name of names) {
        el.addEventListener(`aero:${name}`, (event) => {
          if (event.target === el) log.push(name + ((event as CustomEvent).detail?.index ?? ""));
        });
      }
    },
    [id, names] as const
  );
  return () => page.evaluate((id) => window.eventLog[id]!.slice(), id);
}

/** Asserts `actual` is within `tolerance` px of `expected`, for layouts with fractional sizes. */
export function expectNear(actual: number, expected: number, tolerance = 1.5): void {
  expect(
    Math.abs(actual - expected),
    `expected ${actual} to be within ${tolerance} of ${expected}`
  ).toBeLessThanOrEqual(tolerance);
}
