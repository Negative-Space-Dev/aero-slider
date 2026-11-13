import { create, expect, mount, settled, slider, test } from "./fixtures";

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

test("destroying a slider nested in a thumbnail leaves the sync running", async ({ page }) => {
  const nested = slider("nested", 2, { nav: false, dots: false });
  await mount(
    page,
    slider("main", 3) +
      slider("thumbs", 3, {
        style: "--aero-slides-per-view:3",
        dots: false,
        inner: (i) => (i === 0 ? nested : String(i)),
      })
  );
  await create(page, "nested");
  await create(page, "main");
  await create(page, "thumbs");
  await page.evaluate(() => {
    window.syncThumbnails(window.sliders.main!, window.sliders.thumbs!, { loop: false });
    window.sliders.nested!.destroy();
  });
  await page.locator('#thumbs [data-aero-slider-index="2"]').click();
  await expect.poll(() => page.evaluate(() => window.sliders.main!.currentIndex)).toBe(2);
});

test("the strip drags with the mouse and its thumbnails still click", async ({ page }) => {
  await mount(
    page,
    slider("main", 8) + slider("thumbs", 8, { style: "--aero-slides-per-view:3", dots: false })
  );
  await create(page, "main");
  await create(page, "thumbs");
  await page.evaluate(() =>
    window.syncThumbnails(window.sliders.main!, window.sliders.thumbs!, { loop: false })
  );
  const track = page.locator("#thumbs .aero-slider__track");
  const box = (await track.boundingBox())!;
  const y = box.y + box.height / 2;

  // A slow drag, so the release doesn't fling: the strip moves on its own.
  await page.mouse.move(box.x + box.width - 20, y);
  await page.mouse.down();
  for (let x = box.x + box.width - 20; x > box.x + 20; x -= 20) await page.mouse.move(x, y);
  expect(await track.evaluate((t: HTMLElement) => t.style.cursor)).toBe("grabbing");
  await page.waitForTimeout(150);
  await page.mouse.up();
  await settled(page, "thumbs");
  expect(await track.evaluate((t) => t.scrollLeft)).toBeGreaterThan(0);
  expect(await track.evaluate((t: HTMLElement) => t.style.cursor)).toBe("pointer");
  // The release that ended the drag is not a click on a thumbnail.
  expect(await page.evaluate(() => window.sliders.main!.currentIndex)).toBe(0);

  await page.locator("#thumbs [data-aero-slider-index='4']").click();
  await expect.poll(() => page.evaluate(() => window.sliders.main!.currentIndex)).toBe(4);
});
