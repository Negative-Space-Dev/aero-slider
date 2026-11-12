import { type Page, create, expect, mount, settled, slider, test } from "./fixtures";

const strip = { style: "--slides-per-view:5", dots: false, nav: false };
const index = (page: Page) => page.evaluate(() => window.sliders.main!.currentIndex);
// classList rewrites the class attribute without the fixture's trailing space.
const thumbs = (page: Page) =>
  page.evaluate(() => document.getElementById("thumbs")!.outerHTML.replace(/ "/, '"'));

const setUp = async (page: Page) => {
  await mount(page, slider("main", 4) + slider("thumbs", 4, strip));
  await create(page, "main");
  await create(page, "thumbs");
};
const sync = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { unsync: () => void }).unsync = window.syncThumbnails(
      window.sliders.main!,
      window.sliders.thumbs!
    );
  });

test("thumbnails are buttons that Enter and Space press, with the current one marked", async ({
  page,
}) => {
  await setUp(page);
  await sync(page);
  const track = page.locator("#thumbs .aero-slider__track");
  await expect(track).toMatchAriaSnapshot(`
    - button "Go to slide 1": "0"
    - button "Go to slide 2": "1"
    - button "Go to slide 3": "2"
    - button "Go to slide 4": "3"
  `);
  await expect(track.locator("[aria-current]")).toHaveAccessibleName("Go to slide 1");

  await track.getByRole("button", { name: "Go to slide 3" }).focus();
  await page.keyboard.press("Enter");
  await settled(page, "main");
  expect(await index(page)).toBe(2);
  await expect(track.locator("[aria-current]")).toHaveAccessibleName("Go to slide 3");

  await page.keyboard.press("Tab");
  await expect(track.getByRole("button", { name: "Go to slide 4" })).toBeFocused();
  await page.keyboard.press(" ");
  await settled(page, "main");
  expect(await index(page)).toBe(3);
});

test("a rebuild keeps the thumbnail buttons; teardown gives back the slides, destroy the markup", async ({
  page,
}) => {
  await mount(page, slider("main", 4) + slider("thumbs", 4, strip));
  const original = await thumbs(page);
  await create(page, "main");
  await create(page, "thumbs");
  await sync(page);
  await page.evaluate(() => window.sliders.thumbs!.refresh());
  const track = page.locator("#thumbs .aero-slider__track");
  await expect(track.getByRole("button")).toHaveCount(4);
  await expect(track.locator("[aria-roledescription]")).toHaveCount(0);

  await page.evaluate(() => (window as unknown as { unsync: () => void }).unsync());
  await expect(track).toMatchAriaSnapshot(`
    - group "1 of 4": "0"
    - group "2 of 4": "1"
    - group "3 of 4": "2"
    - group "4 of 4": "3"
  `);
  await expect(track.locator("[aria-roledescription=slide]")).toHaveCount(4);
  await expect(track.locator("[tabindex], [aria-current]")).toHaveCount(0);
  await page.evaluate(() => window.sliders.thumbs!.destroy());
  expect(await thumbs(page)).toBe(original);
});

test("destroying a synced strip leaves no thumbnail semantics behind", async ({ page }) => {
  await setUp(page);
  await sync(page);
  await page.evaluate(() => window.sliders.thumbs!.destroy());
  await expect(
    page.locator("#thumbs").locator("[role], [tabindex], [aria-current], [aria-label]")
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
