import { type Page, create, expect, mount, settled, slider, test } from "./fixtures";

declare global {
  interface Window {
    /** Calls counted since `countMeasuring`. */
    measuring: { rects: number; styles: number };
    /** Names of the calls made since `countLayoutReads`. */
    layoutReads: string[];
  }
}

/** Counts every `getBoundingClientRect` and `getComputedStyle` call the page makes from now on. */
const countMeasuring = (page: Page) =>
  page.evaluate(() => {
    const calls = (window.measuring = { rects: 0, styles: 0 });
    const rect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      calls.rects++;
      return rect.call(this);
    };
    const style = window.getComputedStyle;
    window.getComputedStyle = (...args) => {
      calls.styles++;
      return style(...args);
    };
  });

for (const loop of [false, true]) {
  test(`moving a ${loop ? "looped" : "plain"} slider measures nothing`, async ({ page }) => {
    await mount(page, slider("s", 8, { style: "--aero-slides-per-view:3" }));
    await create(page, "s", { loop });
    await settled(page, "s");
    await countMeasuring(page);

    for (const move of ["goTo", "next", "prev"] as const) {
      await page.evaluate((move) => window.sliders.s![move](3), move);
      await settled(page, "s");
    }
    expect(await page.evaluate(() => window.sliders.s!.currentIndex)).toBe(3);

    // A scroll the slider did not start, as a wheel or a finger makes.
    await page.evaluate(() => {
      document.querySelector("#s .aero-slider__track")!.scrollBy({ left: 400, behavior: "smooth" });
    });
    await settled(page, "s");
    expect(await page.evaluate(() => window.sliders.s!.currentIndex)).toBe(5);

    expect(await page.evaluate(() => window.measuring)).toEqual({ rects: 0, styles: 0 });
  });
}

/**
 * Counts, from now on, every call that makes the browser lay the page out before it can answer:
 * box and scroll reads, computed styles, and scrolling itself.
 */
const countLayoutReads = (page: Page) =>
  page.evaluate(() => {
    window.layoutReads = [];
    const note = (name: string) => window.layoutReads.push(name);
    const getters = [
      "scrollLeft",
      "scrollTop",
      "scrollWidth",
      "scrollHeight",
      "clientWidth",
      "clientHeight",
      "clientLeft",
      "clientTop",
      "offsetWidth",
      "offsetHeight",
      "offsetLeft",
      "offsetTop",
    ];
    const methods = ["getBoundingClientRect", "getClientRects", "scrollTo", "scrollBy", "scroll"];
    for (const proto of [Element.prototype, HTMLElement.prototype]) {
      for (const name of [...getters, ...methods]) {
        const own = Object.getOwnPropertyDescriptor(proto, name);
        if (!own) continue;
        const wrap = (fn: (...args: unknown[]) => unknown) =>
          function (this: unknown, ...args: unknown[]) {
            note(name);
            return fn.apply(this, args);
          };
        if (own.get) Object.defineProperty(proto, name, { ...own, get: wrap(own.get) });
        else Object.defineProperty(proto, name, { ...own, value: wrap(own.value) });
      }
    }
    const style = window.getComputedStyle;
    window.getComputedStyle = (...args) => {
      note("getComputedStyle");
      return style(...args);
    };
  });

// A slideChange handler has usually just changed the page, so any of these calls made from a
// synced slider's goTo() lays the whole page out in the middle of a swipe.
for (const loop of [false, true]) {
  test(`a resting ${loop ? "looped" : "plain"} slider starts a move without a layout`, async ({
    page,
  }) => {
    await mount(page, slider("s", 8, { style: "--aero-slides-per-view:3" }));
    await create(page, "s", { loop });
    await settled(page, "s");
    await countLayoutReads(page);

    for (const [move, index] of [
      ["goTo", 3],
      ["goTo", 3], // already there
      ["next", 4],
      ["prev", 3],
    ] as const) {
      const reads = await page.evaluate((move) => {
        window.layoutReads.length = 0;
        window.sliders.s![move](3);
        return window.layoutReads.slice();
      }, move);
      expect(reads, move).toEqual([]);
      await settled(page, "s");
      expect(await page.evaluate(() => window.sliders.s!.currentIndex)).toBe(index);
    }
    // Slide 3 of 8 at three per view, centred: its start edge is one slide in from the track's.
    const offset = await page.evaluate(() => {
      const track = document.querySelector("#s .aero-slider__track")!;
      const slide = track.querySelector('[data-aero-slider-index="3"]')!;
      return Math.round(slide.getBoundingClientRect().left - track.getBoundingClientRect().left);
    });
    expect(offset).toBe(200);
  });
}
