import { type Page, create, expect, mount, slider, test } from "./fixtures";
import { recordEvents, takeEvents } from "./helpers/state";

const lifecycle = async (page: Page) =>
  (await takeEvents(page, "s")).filter((e) => /^(ready|autoplay)/.test(e));

for (const autoplay of [true, "continuous"] as const) {
  test(`autoplay ${autoplay}: ready comes before autoplayStart`, async ({ page }) => {
    await mount(page, slider("s", 5, { style: "--slides-per-view:2" }));
    await recordEvents(page, "s");
    await create(page, "s", { autoplay });
    expect(await lifecycle(page)).toEqual(["ready", "autoplayStart"]);
  });
}

test("rebuilding keeps interval autoplay running without announcing it again", async ({ page }) => {
  await mount(page, slider("s", 5));
  await recordEvents(page, "s");
  await create(page, "s", { autoplay: true, autoplayInterval: 200 });
  await takeEvents(page, "s");
  await page.evaluate(() => {
    const s = window.sliders.s!;
    s.update({ perMove: 1 });
    s.refresh();
    const slide = document.createElement("div");
    slide.innerHTML = "<div>new</div>";
    s.add(slide);
    s.remove(5);
  });
  expect(await lifecycle(page)).toEqual([]);
  await expect.poll(() => page.evaluate(() => window.sliders.s!.currentIndex)).toBeGreaterThan(0);

  await page.evaluate(() => window.sliders.s!.update({ autoplay: false }));
  expect(await lifecycle(page)).toEqual(["autoplayStop"]);
  await page.evaluate(() => window.sliders.s!.update({ autoplay: true }));
  expect(await lifecycle(page)).toEqual(["autoplayStart"]);
});
