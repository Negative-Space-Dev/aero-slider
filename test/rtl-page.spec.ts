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

  test("refresh() picks up the new dir", async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.dir = "rtl";
      window.sliders.s!.refresh();
      window.sliders.s!.next();
    });
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 1, position: -610 });
  });

  test("refresh() picks up a direction set in CSS", async ({ page }) => {
    await page.evaluate(() => {
      document.body.style.direction = "rtl";
      window.sliders.s!.refresh();
      window.sliders.s!.goTo(2);
    });
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 2, position: -1220 });
  });

  test("arrow keys go the right-to-left way after refresh()", async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.dir = "rtl";
      window.sliders.s!.refresh();
    });
    await page.locator("#s").focus();
    await page.keyboard.press("ArrowLeft");
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 1, position: -610 });
  });

  test("the slider keeps its slide through the refresh()", async ({ page }) => {
    await page.evaluate(() => window.sliders.s!.goTo(2, { instant: true }));
    await page.evaluate(() => {
      document.documentElement.dir = "rtl";
      window.sliders.s!.refresh();
    });
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 2, position: -1220 });
  });
});

test("a vertical slider on a right-to-left page still scrolls top to bottom", async ({ page }) => {
  await mount(page, slider("s", 5, { style: "height:300px" }), rtl);
  await create(page, "s", { vertical: true });
  const offsets = () =>
    page.evaluate(() => {
      const track = document.querySelector<HTMLElement>("#s .aero-slider__track")!;
      return {
        top: track.scrollTop,
        left: track.scrollLeft,
        index: window.sliders.s!.currentIndex,
      };
    });

  await page.evaluate(() => window.sliders.s!.next());
  await settled(page, "s");
  const first = await offsets();
  expect(first).toEqual({ top: expect.any(Number), left: 0, index: 1 });
  expect(first.top).toBeGreaterThan(100);

  await page.locator("#s").focus();
  await page.keyboard.press("ArrowDown");
  await settled(page, "s");
  expect(await offsets()).toEqual({ top: first.top * 2, left: 0, index: 2 });
});
