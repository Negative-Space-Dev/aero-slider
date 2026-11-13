import { type Page, create, expect, mount, settled, slider, test } from "./fixtures";

declare global {
  interface Window {
    /** Calls counted since `countMeasuring`. */
    measuring: { rects: number; styles: number };
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
