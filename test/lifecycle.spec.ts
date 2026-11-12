import { create, expect, failOnPageErrors, mount, slider, test } from "./fixtures";

failOnPageErrors();

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

test("destroy() restores the markup and leaves the API inert", async ({ page }) => {
  await mount(page, slider("s", 4));
  await create(page, "s", { direction: "rtl" });
  const el = page.locator("#s");
  await expect(el).toHaveAttribute("tabindex", "0");
  await expect(el).toHaveAttribute("dir", "rtl");

  await page.evaluate(() => {
    window.sliders.s!.destroy();
    window.sliders.s!.next();
  });
  expect(await el.evaluate((el) => el.aeroSlider)).toBeUndefined();
  await expect(el).not.toHaveAttribute("tabindex");
  await expect(el).not.toHaveAttribute("dir");
  await expect(page.locator("#s .aero-slider__dot")).toHaveCount(1);
  expect(await page.evaluate(() => window.sliders.s!.currentIndex)).toBe(0);
});

test("resume() after destroy() doesn't start autoplay", async ({ page }) => {
  await mount(page, slider("s", 3));
  await create(page, "s", { loop: true, autoplay: true, autoplayInterval: 100 });
  const starts = await page.evaluate(() => {
    let starts = 0;
    document.getElementById("s")!.addEventListener("aero:autoplayStart", () => starts++);
    window.sliders.s!.destroy();
    window.sliders.s!.resume();
    return new Promise<number>((resolve) => setTimeout(() => resolve(starts), 300));
  });
  expect(starts).toBe(0);
  expect(await page.evaluate(() => window.sliders.s!.currentIndex)).toBe(0);
});
