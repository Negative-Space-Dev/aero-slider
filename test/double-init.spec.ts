import { create, expect, mount, settled, slider, test } from "./fixtures";
import { recordEvents, takeEvents } from "./helpers/state";

test("a second createSlider replaces the first", async ({ page }) => {
  await mount(page, slider("s", 5));
  await create(page, "s", { loop: true });
  const clones = await page.locator("#s [data-aero-slider-clone]").count();
  const replaced = await page.evaluate(() => {
    const el = document.getElementById("s")!;
    const first = window.sliders.s;
    window.sliders.s = window.createSlider(el, { loop: true });
    return el.aeroSlider === window.sliders.s && el.aeroSlider !== first;
  });
  expect(replaced).toBe(true);
  await expect(page.locator("#s .aero-slider__dot")).toHaveCount(5);
  await expect(page.locator("#s [data-aero-slider-clone]")).toHaveCount(clones);

  await recordEvents(page, "s");
  await page.locator("#s .aero-slider__nav--next").click();
  await settled(page, "s");
  const changes = (await takeEvents(page, "s")).filter((e) => e.startsWith("slideChange"));
  expect(changes).toEqual(["slideChange:1"]);
});
