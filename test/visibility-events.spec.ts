import { type Page, create, expect, mount, slider, test } from "./fixtures";
import { recordEvents } from "./helpers/state";

/** Slides currently visible according to the `visible` and `hidden` events logged so far. */
const visibleSlides = (page: Page) =>
  page.evaluate(() => {
    const shown = new Set<number>();
    for (const event of window.events.s!) {
      const [name, index] = event.split(":");
      if (name === "visible") shown.add(Number(index));
      if (name === "hidden") shown.delete(Number(index));
    }
    return [...shown].sort((a, b) => a - b);
  });

for (const alignment of ["left", "center"] as const) {
  test(`${alignment}-aligned, the last slides report visible`, async ({ page }) => {
    await mount(page, slider("s", 6, { style: "--slides-per-view:3" }));
    await recordEvents(page, "s");
    await create(page, "s", { alignment });
    await expect.poll(() => visibleSlides(page)).toEqual([0, 1, 2]);
    await page.evaluate(() => window.sliders.s!.goTo(5));
    await expect.poll(() => visibleSlides(page)).toEqual([3, 4, 5]);
  });
}

test("on a loop, clones report the slide they copy", async ({ page }) => {
  await mount(page, slider("s", 6, { style: "--slides-per-view:3" }));
  await recordEvents(page, "s");
  await create(page, "s", { loop: true });
  await expect.poll(() => visibleSlides(page)).toEqual([0, 1, 5]);
});
