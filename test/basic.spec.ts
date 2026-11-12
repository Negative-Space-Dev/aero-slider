import { create, expect, mount, slider, test } from "./fixtures";

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
