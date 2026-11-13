import { create, expect, mount, settled, slider, test } from "./fixtures";
import { drag, state } from "./helpers/state";

const rtl = { htmlAttributes: { dir: "rtl" } };
const gap = { style: "--aero-slide-gap:10px" };

test.describe("on a right-to-left page", () => {
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

test("dir=ltr on a slider inside a right-to-left page scrolls left to right", async ({ page }) => {
  await mount(page, slider("s", 5, gap), rtl);
  await page.evaluate(() => document.getElementById("s")!.setAttribute("dir", "ltr"));
  await create(page, "s");
  await page.evaluate(() => window.sliders.s!.next());
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 1, position: 610 });
});

test("a dir the page sets after creation survives a refresh and destroy", async ({ page }) => {
  await mount(page, slider("s", 5, gap));
  await create(page, "s");
  const container = page.locator("#s");
  await container.evaluate((el) => el.setAttribute("dir", "rtl"));
  await page.evaluate(() => window.sliders.s!.refresh());
  await expect(container).toHaveAttribute("dir", "rtl");
  await page.evaluate(() => window.sliders.s!.next());
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 1, position: -610 });
  await page.evaluate(() => window.sliders.s!.destroy());
  await expect(container).toHaveAttribute("dir", "rtl");
});

test.describe("a page that turns right-to-left after creation", () => {
  test.beforeEach(async ({ page }) => {
    await mount(page, slider("s", 5, gap));
    await create(page, "s");
  });

  test("next() in the same task as the dir change moves the track", async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.dir = "rtl";
      window.sliders.s!.next();
    });
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 1, position: -610 });
  });

  test("a direction set in CSS, with no dir attribute, is picked up by the next move", async ({
    page,
  }) => {
    await page.evaluate(() => {
      document.body.style.direction = "rtl";
      window.sliders.s!.goTo(2);
    });
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 2, position: -1220 });
  });

  test("the first arrow key after the dir change goes the right-to-left way", async ({ page }) => {
    await page.evaluate(() => (document.documentElement.dir = "rtl"));
    await page.locator("#s").focus();
    await page.keyboard.press("ArrowLeft");
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 1, position: -610 });
  });

  test("the slider keeps its slide when the page turns", async ({ page }) => {
    await page.evaluate(() => window.sliders.s!.goTo(2, { instant: true }));
    await page.evaluate(() => (document.documentElement.dir = "rtl"));
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 2, position: -1220 });
  });
});
