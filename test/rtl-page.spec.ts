import { create, expect, mount, settled, slider, test } from "./fixtures";
import { drag, state } from "./helpers/state";

const rtl = { htmlAttributes: { dir: "rtl" } };
const gap = { style: "--slide-gap:10px" };

test.describe("on a right-to-left page with the default direction", () => {
  test.beforeEach(async ({ page }) => {
    await mount(page, slider("s", 5, gap), rtl);
    await create(page, "s");
  });

  test("next, prev and goTo move the track", async ({ page }) => {
    await page.evaluate(() => window.sliders.s!.next());
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 1, position: -610 });

    await page.evaluate(() => window.sliders.s!.goTo(3));
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 3, position: -1830 });

    await page.evaluate(() => window.sliders.s!.prev());
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 2, position: -1220 });
  });

  test("a dot click goes to its slide", async ({ page }) => {
    await page.locator("#s .aero-slider__dot").nth(2).click();
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 2, position: -1220 });
  });

  test("dragging right brings in the next slide", async ({ page }) => {
    await drag(page, "s", 200, 250);
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 1, position: -610 });
  });

  test("the left arrow key goes forward", async ({ page }) => {
    await page.locator("#s").focus();
    await page.keyboard.press("ArrowLeft");
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 1, position: -610 });
  });

  test("the container gets no dir attribute", async ({ page }) => {
    await expect(page.locator("#s")).not.toHaveAttribute("dir");
  });
});

test("direction: ltr inside a right-to-left page scrolls left to right", async ({ page }) => {
  await mount(page, slider("s", 5, gap), rtl);
  await create(page, "s", { direction: "ltr" });
  await expect(page.locator("#s")).toHaveAttribute("dir", "ltr");
  await page.evaluate(() => window.sliders.s!.next());
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 1, position: 610 });
});

test("an author's dir attribute survives create, update and destroy", async ({ page }) => {
  await mount(page, slider("s", 5, gap));
  const container = page.locator("#s");
  await page.evaluate(() => document.getElementById("s")!.setAttribute("dir", "rtl"));
  await create(page, "s");
  await expect(container).toHaveAttribute("dir", "rtl");
  await page.evaluate(() => window.sliders.s!.next());
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 1, position: -610 });

  await page.evaluate(() => window.sliders.s!.update({ direction: "ltr" }));
  await expect(container).toHaveAttribute("dir", "ltr");
  await page.evaluate(() => window.sliders.s!.update({ direction: "auto" }));
  await expect(container).toHaveAttribute("dir", "rtl");

  await page.evaluate(() => window.sliders.s!.destroy());
  await expect(container).toHaveAttribute("dir", "rtl");
});

test("going back to direction: auto removes the dir the slider wrote", async ({ page }) => {
  await mount(page, slider("s", 5, gap));
  await create(page, "s", { direction: "rtl" });
  await expect(page.locator("#s")).toHaveAttribute("dir", "rtl");
  await page.evaluate(() => window.sliders.s!.update({ direction: "auto" }));
  await expect(page.locator("#s")).not.toHaveAttribute("dir");
});
