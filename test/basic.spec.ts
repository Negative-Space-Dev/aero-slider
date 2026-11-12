import { type Page, create, expect, mount, settled, slider, test } from "./fixtures";

const state = (page: Page, id: string) =>
  page.evaluate((id) => {
    const track = document.querySelector<HTMLElement>(`#${id} .aero-slider__track`)!;
    return { index: window.sliders[id]!.currentIndex, position: Math.round(track.scrollLeft) };
  }, id);

test("next and prev move the track one slide", async ({ page }) => {
  await mount(page, slider("s", 5, { style: "--slide-gap:10px" }));
  await create(page, "s");

  await page.evaluate(() => window.sliders.s!.next());
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 1, position: 610 });

  await page.evaluate(() => window.sliders.s!.prev());
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 0, position: 0 });
});

test("a dot click goes to its slide", async ({ page }) => {
  await mount(page, slider("s", 5, { style: "--slide-gap:10px" }));
  await create(page, "s");

  await page.locator("#s .aero-slider__dot").nth(2).click();
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 2, position: 1220 });
});

test("a loop wraps from the last slide to the first", async ({ page }) => {
  await mount(page, slider("s", 4));
  await create(page, "s", { loop: true });
  const start = await state(page, "s");
  expect(start.index).toBe(0);

  await page.evaluate(() => window.sliders.s!.goTo(3));
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 3, position: start.position + 1800 });

  await page.evaluate(() => window.sliders.s!.next());
  await settled(page, "s");
  expect(await state(page, "s")).toEqual(start);
});

test("destroy() removes the loop clones", async ({ page }) => {
  await mount(page, slider("s", 4));
  await create(page, "s", { loop: true });
  const clones = page.locator("#s [data-aero-slider-clone]");
  const slides = page.locator("#s .aero-slider__track > *");
  await expect(clones).not.toHaveCount(0);

  await page.evaluate(() => window.sliders.s!.destroy());
  await expect(clones).toHaveCount(0);
  await expect(slides).toHaveText(["0", "1", "2", "3"]);
});
