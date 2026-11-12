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

test("list item thumbnails are list items again after teardown", async ({ page }) => {
  const list = (id: string) =>
    `<div id="${id}" class="aero-slider" style="width:600px;--slides-per-view:5"><div class="aero-slider__viewport"><ul class="aero-slider__track" style="margin:0;padding:0;list-style:none"><li>0</li><li>1</li><li>2</li><li>3</li></ul></div></div>`;
  await mount(page, slider("main", 4) + list("thumbs"));
  await create(page, "main");
  await create(page, "thumbs");
  await sync(page);
  const items = page.locator("#thumbs li[data-aero-slider-index]");
  await expect(items.first()).toHaveAttribute("role", "button");
  await page.evaluate(() => (window as unknown as { unsync: () => void }).unsync());
  for (const item of await items.all()) await expect(item).not.toHaveAttribute("role");
  await expect(page.locator("#thumbs").getByRole("listitem")).toHaveCount(4);
});

const PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

test("image thumbnails become buttons named by their alt text, and images again after teardown", async ({
  page,
}) => {
  const images = ["Red", "Green", "", "Blue"]
    .map((alt) => `<img alt="${alt}" src="${PIXEL}" style="height:40px">`)
    .join("");
  await mount(
    page,
    slider("main", 4) +
      `<div id="thumbs" class="aero-slider" style="width:600px;--slides-per-view:5"><div class="aero-slider__viewport"><div class="aero-slider__track">${images}</div></div></div>`
  );
  await create(page, "main");
  await create(page, "thumbs");
  await page.evaluate(() => {
    (window as unknown as { unsync: () => void }).unsync = window.syncThumbnails(
      window.sliders.main!,
      window.sliders.thumbs!,
      { loop: false }
    );
  });
  const track = page.locator("#thumbs .aero-slider__track");
  await expect(track).toMatchAriaSnapshot(`
    - button "Red"
    - button "Green"
    - button "Go to slide 3"
    - button "Blue"
  `);

  await track.getByRole("button", { name: "Green" }).focus();
  await page.keyboard.press("Enter");
  await settled(page, "main");
  expect(await index(page)).toBe(1);

  await page.evaluate(() => (window as unknown as { unsync: () => void }).unsync());
  await expect(track.locator("[role], [tabindex], [aria-label]")).toHaveCount(0);
});

test("thumbnails the author made buttons take Enter and Space", async ({ page }) => {
  await mount(page, slider("main", 4) + slider("thumbs", 4, strip));
  await page.evaluate(() => {
    for (const slide of document.querySelectorAll("#thumbs .aero-slider__track > *")) {
      slide.setAttribute("role", "button");
      slide.setAttribute("tabindex", "0");
    }
  });
  await create(page, "main");
  await create(page, "thumbs");
  await sync(page);
  const thumbnails = page.locator("#thumbs [data-aero-slider-index]");
  await thumbnails.nth(1).focus();
  await page.keyboard.press("Enter");
  await settled(page, "main");
  expect(await index(page)).toBe(1);
  await thumbnails.nth(3).focus();
  await page.keyboard.press(" ");
  await settled(page, "main");
  expect(await index(page)).toBe(3);
});
