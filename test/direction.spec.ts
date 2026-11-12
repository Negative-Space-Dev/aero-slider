import { create, expect, failOnPageErrors, mount, settled, slider, state, test } from "./fixtures";

failOnPageErrors();

test.describe("rtl", () => {
  test.beforeEach(async ({ page }) => {
    await mount(page, slider("s", 4));
    await create(page, "s", { direction: "rtl" });
  });

  test("next() scrolls toward the left, on negative offsets", async ({ page }) => {
    await page.evaluate(() => window.sliders.s!.next());
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 1, position: -600 });
    await expect(page.locator("#s")).toHaveAttribute("dir", "rtl");
  });

  test("ArrowRight goes back a slide", async ({ page }) => {
    await page.evaluate(() => window.sliders.s!.next());
    await settled(page, "s");
    await page.locator("#s").focus();
    await page.keyboard.press("ArrowRight");
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 0, position: 0 });
  });
});
