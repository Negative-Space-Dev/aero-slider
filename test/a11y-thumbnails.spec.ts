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

test("plain thumbnails become buttons that Enter and Space press, and teardown takes them back", async ({
  page,
}) => {
  await mount(page, slider("main", 8) + slider("thumbs", 8, strip));
  const original = await thumbs(page);
  await create(page, "main");
  await create(page, "thumbs");
  await sync(page, false);
  const track = page.locator("#thumbs .aero-slider__track");
  // Each has text, so it keeps its own name.
  await expect(track.getByRole("button")).toHaveCount(8);
  await expect(track.locator("[tabindex='0']")).toHaveCount(8);
  await expect(track.locator("[aria-label]")).toHaveCount(0);
  await expect(track.locator("[aria-current]")).toHaveCount(1);

  await track.getByRole("button", { name: "2", exact: true }).focus();
  await page.keyboard.press("Enter");
  await settled(page, "main");
  expect(await index(page)).toBe(2);
  await expect(track.locator("[aria-current]")).toHaveText("2");

  await page.keyboard.press("Tab");
  await page.keyboard.press(" ");
  await settled(page, "main");
  expect(await index(page)).toBe(3);
  expect(await page.evaluate(() => window.scrollY)).toBe(0); // Space didn't scroll the page

  // Arrow keys still move the strip from its own tab stop.
  await page.locator("#thumbs").focus();
  await page.keyboard.press("ArrowRight");
  await settled(page, "thumbs");
  expect(await page.evaluate(() => window.sliders.thumbs!.currentIndex)).toBe(4);

  await page.evaluate(() => (window as unknown as { unsync: () => void }).unsync());
  await expect(track.locator("[aria-current], [role], [tabindex]")).toHaveCount(0);
  await page.keyboard.press("Enter"); // a released thumbnail does nothing
  await page.evaluate(() => window.sliders.thumbs!.destroy());
  expect(await thumbs(page)).toBe(original);
});

test("unnamed thumbnails are named for their slide, and rebuilt strips stay buttons", async ({
  page,
}) => {
  const images = { ...strip, inner: () => `<img alt="" width="40" height="40">` };
  await mount(page, slider("main", 8) + slider("thumbs", 8, images));
  const original = await thumbs(page);
  await create(page, "main");
  await create(page, "thumbs");
  await sync(page);
  const track = page.locator("#thumbs .aero-slider__track");
  const real = track.locator("[data-aero-slider-index]");
  const clones = track.locator("[data-aero-slider-clone]");
  await expect(real.nth(2)).toHaveAccessibleName("Go to slide 3");
  await expect(track.getByRole("button")).toHaveCount(8); // clones are hidden

  // A new first thumbnail, then refresh(): it becomes a button and the names follow the numbers.
  await page.evaluate(() => {
    const track = document.querySelector("#thumbs .aero-slider__track")!;
    track.prepend(Object.assign(document.createElement("div"), { innerHTML: "<img alt=''>" }));
    window.sliders.thumbs!.refresh();
    document
      .querySelector("#main .aero-slider__track")!
      .prepend(Object.assign(document.createElement("div"), { textContent: "new" }));
    window.sliders.main!.refresh();
  });
  await expect(track.getByRole("button")).toHaveCount(9);
  await expect(real.first()).toHaveAccessibleName("Go to slide 1");
  await expect(real.nth(3)).toHaveAccessibleName("Go to slide 4");
  await expect(clones).not.toHaveCount(0);
  for (const clone of await clones.all()) {
    await expect(clone).toHaveAttribute("aria-hidden", "true");
    await expect(clone).not.toHaveAttribute("tabindex", "0");
  }

  // update() rebuilds the clones too.
  await page.evaluate(() => window.sliders.thumbs!.update({ loop: false }));
  await expect(clones).toHaveCount(0);
  await expect(track.getByRole("button")).toHaveCount(9);

  // Removing the new thumbnail lets it go, and destroy without the teardown restores the rest.
  const removed = await page.evaluate(() => {
    const first = document.querySelector<HTMLElement>("#thumbs [data-aero-slider-index='0']")!;
    first.remove();
    window.sliders.thumbs!.refresh();
    return first;
  });
  expect(removed).toBeTruthy();
  await expect(track.getByRole("button")).toHaveCount(8);
  await expect(real.first()).toHaveAccessibleName("Go to slide 1");
  await page.evaluate(() => window.sliders.thumbs!.destroy());
  expect(await thumbs(page)).toBe(original);
});

test("Enter on a button inside a thumbnail is left to the button", async ({ page }) => {
  const inner = { ...strip, inner: (i: number) => `<button type="button">${i}</button>` };
  await mount(page, slider("main", 4) + slider("thumbs", 4, inner));
  await create(page, "main");
  await create(page, "thumbs");
  await sync(page, false);
  const track = page.locator("#thumbs .aero-slider__track");
  await expect(track.locator("[role], [tabindex]")).toHaveCount(0);
  await track.getByRole("button", { name: "2" }).focus();
  await page.keyboard.press("Enter");
  await settled(page, "main");
  expect(await index(page)).toBe(2);
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
