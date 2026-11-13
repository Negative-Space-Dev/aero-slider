import { type Page, create, expect, mount, slider, test } from "./fixtures";
import { recordEvents, takeEvents } from "./helpers/state";

const lifecycle = async (page: Page) =>
  (await takeEvents(page, "s")).filter((e) => /^(ready|autoplay)/.test(e));

for (const autoplay of [true, "continuous"] as const) {
  test(`autoplay ${autoplay}: ready comes before autoplayStart`, async ({ page }) => {
    await mount(page, slider("s", 5, { style: "--aero-slides-per-view:2" }));
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
    const slide = document.createElement("div");
    slide.innerHTML = "<div>new</div>";
    s.element.querySelector(".aero-slider__track")!.append(slide);
    s.refresh();
  });
  expect(await lifecycle(page)).toEqual([]);
  await expect.poll(() => page.evaluate(() => window.sliders.s!.currentIndex)).toBeGreaterThan(0);

  await page.evaluate(() => window.sliders.s!.update({ autoplay: false }));
  expect(await lifecycle(page)).toEqual(["autoplayStop"]);
  await page.evaluate(() => window.sliders.s!.update({ autoplay: true }));
  expect(await lifecycle(page)).toEqual(["autoplayStart"]);
});

for (const config of [{}, { loop: true }, { autoplay: "continuous" as const }]) {
  test(`destroy() leaves slide markup as it found it: ${JSON.stringify(config)}`, async ({
    page,
  }) => {
    await mount(page, slider("s", 5, { style: "--aero-slides-per-view:2" }));
    const markup = () =>
      page.evaluate(() => document.querySelector("#s .aero-slider__track")!.innerHTML);
    await page.evaluate(() => {
      const [, first, second] = document.querySelectorAll<HTMLElement>(
        "#s .aero-slider__track > *"
      );
      first!.className = "aero-slider__slide promo";
      second!.className = "promo";
    });
    const before = await markup();
    await create(page, "s", config);
    await page.evaluate(() => window.sliders.s!.goTo(2, { instant: true }));
    await page.evaluate(() => window.sliders.s!.destroy());
    expect(await markup()).toBe(before);
  });
}
