import { create, expect, mount, slider, test } from "./fixtures";

const fiveUp = { style: "--aero-slides-per-view:5", dots: false };

test("a loop whose slides all fit makes no clones", async ({ page }) => {
  await mount(page, slider("main", 4) + slider("thumbs", 4, fiveUp));
  await create(page, "main");
  await create(page, "thumbs");
  await page.evaluate(() => window.syncThumbnails(window.sliders.main!, window.sliders.thumbs!));
  await expect(page.locator("#thumbs .aero-slider__track > *")).toHaveCount(4);
  await expect(page.locator("#thumbs [data-aero-slider-clone]")).toHaveCount(0);
  await expect(page.locator("#thumbs .aero-slider__nav--next")).toBeDisabled();
});

test("a loop starts cloning once the slides overflow", async ({ page }) => {
  await mount(page, slider("s", 6, fiveUp));
  await create(page, "s", { loop: true });
  await expect(page.locator("#s [data-aero-slider-clone]")).not.toHaveCount(0);
  await expect(page.locator("#s .aero-slider__nav--next")).toBeEnabled();
});

test("continuous autoplay with few slides still clones them", async ({ page }) => {
  await mount(page, slider("s", 4, fiveUp));
  await create(page, "s", { autoplay: "continuous" });
  await expect(page.locator("#s [data-aero-slider-clone]")).not.toHaveCount(0);
});

test("thumbnails ignore a slider nested inside the primary", async ({ page }) => {
  const nested = slider("nested", 4, { nav: false, dots: false });
  await mount(
    page,
    slider("main", 3, { inner: (i) => (i === 0 ? nested : String(i)) }) +
      slider("thumbs", 3, { style: "--aero-slides-per-view:3", dots: false })
  );
  await create(page, "nested");
  await create(page, "main");
  await create(page, "thumbs");
  await page.evaluate(() => {
    window.syncThumbnails(window.sliders.main!, window.sliders.thumbs!);
    window.sliders.nested!.goTo(2, { instant: true });
  });
  await expect(page.locator("#thumbs .aero-slider__thumb--active")).toHaveText("0");
  expect(await page.evaluate(() => window.sliders.thumbs!.currentIndex)).toBe(0);
});
