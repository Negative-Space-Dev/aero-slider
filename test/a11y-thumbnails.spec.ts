import { type Page, create, expect, mount, settled, slider, test } from "./fixtures";

const strip = { style: "--aero-slides-per-view:5", dots: false, nav: false };
const index = (page: Page) => page.evaluate(() => window.sliders.main!.currentIndex);
// classList rewrites the class attribute without the fixture's trailing space.
const thumbs = (page: Page) =>
  page.evaluate(() => document.getElementById("thumbs")!.outerHTML.replace(/ "/, '"'));

/** A strip whose thumbnails are named buttons, as the docs tell authors to write them. */
const buttonStrip = (n: number) =>
  `<div id="thumbs" class="aero-slider" style="width:600px;--aero-slides-per-view:5"><div class="aero-slider__viewport"><div class="aero-slider__track">${Array.from(
    { length: n },
    (_, i) => `<button type="button" aria-label="Show photo ${i + 1}">${i}</button>`
  ).join("")}</div></div></div>`;

const sync = (page: Page, loop = true) =>
  page.evaluate((loop) => {
    (window as unknown as { unsync: () => void }).unsync = window.syncThumbnails(
      window.sliders.main!,
      window.sliders.thumbs!,
      { loop }
    );
  }, loop);

test("button thumbnails press with Enter and Space, and the current one is marked", async ({
  page,
}) => {
  await mount(page, slider("main", 4) + buttonStrip(4));
  await create(page, "main");
  await create(page, "thumbs");
  await sync(page, false);
  const track = page.locator("#thumbs .aero-slider__track");
  await expect(track.locator("[aria-current]")).toHaveAccessibleName("Show photo 1");

  await track.getByRole("button", { name: "Show photo 3" }).focus();
  await page.keyboard.press("Enter");
  await settled(page, "main");
  expect(await index(page)).toBe(2);
  await expect(track.locator("[aria-current]")).toHaveAccessibleName("Show photo 3");

  await page.keyboard.press("Tab");
  await expect(track.getByRole("button", { name: "Show photo 4" })).toBeFocused();
  await page.keyboard.press(" ");
  await settled(page, "main");
  expect(await index(page)).toBe(3);
  await expect(track.locator("[aria-current]")).toHaveCount(1);
});

test("on a looping strip only the real thumbnail is marked current, never its clones", async ({
  page,
}) => {
  await mount(page, slider("main", 8) + buttonStrip(8));
  await create(page, "main");
  await create(page, "thumbs");
  await sync(page);
  const track = page.locator("#thumbs .aero-slider__track");
  expect(await track.locator("[data-aero-slider-clone]").count()).toBeGreaterThan(0);
  await expect(track.locator("[aria-current]")).toHaveCount(1);
  await expect(track.locator("[data-aero-slider-clone][aria-current]")).toHaveCount(0);
});

test("plain thumbnails get no role or tab stop, and teardown takes the mark back", async ({
  page,
}) => {
  await mount(page, slider("main", 4) + slider("thumbs", 4, strip));
  const original = await thumbs(page);
  await create(page, "main");
  await create(page, "thumbs");
  await sync(page);
  const track = page.locator("#thumbs .aero-slider__track");
  await expect(track.locator("[role], [tabindex='0'], [aria-label]")).toHaveCount(0);
  await expect(track.locator("[aria-current]")).toHaveCount(1);

  await page.evaluate(() => (window as unknown as { unsync: () => void }).unsync());
  await expect(track.locator("[aria-current]")).toHaveCount(0);
  await page.evaluate(() => window.sliders.thumbs!.destroy());
  expect(await thumbs(page)).toBe(original);
});

test("destroying a synced strip without its teardown leaves no mark behind", async ({ page }) => {
  await mount(page, slider("main", 4) + slider("thumbs", 4, strip));
  await create(page, "main");
  await create(page, "thumbs");
  await sync(page);
  await page.evaluate(() => window.sliders.thumbs!.destroy());
  await expect(
    page.locator("#thumbs").locator("[aria-current], .aero-slider__thumb--active")
  ).toHaveCount(0);
});

test("thumbnails that are links keep their own semantics", async ({ page }) => {
  await mount(page, slider("main", 4) + slider("thumbs", 4, strip));
  await page.evaluate(() => {
    for (const [i, slide] of document
      .querySelectorAll("#thumbs .aero-slider__track > *")
      .entries()) {
      const link = document.createElement("a");
      link.href = `#t${i}`;
      link.textContent = `photo ${i}`;
      slide.replaceWith(link);
    }
  });
  await create(page, "main");
  await create(page, "thumbs");
  await sync(page);
  const first = page.locator("#thumbs [data-aero-slider-index]").first();
  await expect(first).not.toHaveAttribute("role", "button");
  await expect(first).not.toHaveAttribute("tabindex");
  await expect(first).toHaveAttribute("aria-current", "true");
});
