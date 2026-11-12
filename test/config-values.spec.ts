import { create, expect, mount, settled, slider, test } from "./fixtures";
import { recordEvents, state, takeEvents } from "./helpers/state";

test("undefined options keep their defaults", async ({ page }) => {
  await mount(page, slider("s", 5));
  await page.evaluate(() => {
    window.sliders.s = window.createSlider(document.getElementById("s")!, {
      perMove: undefined,
      alignment: undefined,
      direction: undefined,
      snap: undefined,
      maxDots: undefined,
      scrollDuration: undefined,
    });
  });
  await page.evaluate(() => window.sliders.s!.next());
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 1, position: 600 });
  await expect(page.locator("#s")).toHaveAttribute("data-aero-alignment", "center");
  await expect(page.locator("#s .aero-slider__dot")).toHaveCount(5);
});

test("update() ignores undefined keys", async ({ page }) => {
  await mount(page, slider("s", 5));
  await create(page, "s", { perMove: 2 });
  await page.evaluate(() => window.sliders.s!.update({ perMove: undefined }));
  await page.evaluate(() => window.sliders.s!.next());
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 2, position: 1200 });
});

for (const interval of [undefined, 0, 50]) {
  test(`autoplayInterval ${interval} never advances faster than every 100ms`, async ({ page }) => {
    await mount(page, slider("s", 5));
    await recordEvents(page, "s");
    await page.evaluate((interval) => {
      const el = document.getElementById("s")!;
      window.sliders.s = window.createSlider(el, { autoplay: true, autoplayInterval: interval });
    }, interval);
    await page.waitForTimeout(1000);
    const changes = (await takeEvents(page, "s")).filter((e) => e.startsWith("slideChange"));
    expect(changes.length).toBeLessThanOrEqual(interval === undefined ? 0 : 11);
  });
}

for (const scrollEasing of [undefined, "ease-out"]) {
  test(`scrollEasing ${scrollEasing} falls back to the default curve`, async ({ page }) => {
    const errors: Error[] = [];
    page.on("pageerror", (error) => errors.push(error));
    await mount(page, slider("s", 5));
    await page.evaluate((scrollEasing) => {
      window.sliders.s = window.createSlider(document.getElementById("s")!, {
        scrollDuration: 300,
        scrollEasing: scrollEasing as never,
      });
    }, scrollEasing);
    await page.evaluate(() => window.sliders.s!.goTo(2));
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 2, position: 1200 });
    const snap = await page.evaluate(
      () => document.querySelector<HTMLElement>("#s .aero-slider__track")!.style.scrollSnapType
    );
    expect(snap).toBe("");
    expect(errors).toEqual([]);
  });
}

test("perMove becomes a whole number of at least 1", async ({ page }) => {
  await mount(page, slider("a", 6) + slider("b", 6) + slider("c", 6) + slider("d", 6));
  await create(page, "a", { perMove: 2.7 });
  await create(page, "b", { perMove: 0 });
  await create(page, "c", { perMove: -3 });
  await create(page, "d", { perMove: NaN });
  await page.evaluate(() => {
    for (const id of ["a", "b", "c", "d"]) window.sliders[id]!.next();
  });
  for (const id of ["a", "b", "c", "d"]) await settled(page, id);
  expect((await state(page, "a")).index).toBe(2);
  expect((await state(page, "b")).index).toBe(1);
  expect((await state(page, "c")).index).toBe(1);
  expect((await state(page, "d")).index).toBe(1);
});

test("a negative or non-finite scrollDuration scrolls natively", async ({ page }) => {
  await mount(page, slider("a", 5) + slider("b", 5));
  await create(page, "a", { scrollDuration: -200 });
  await create(page, "b", { scrollDuration: Infinity });
  await page.evaluate(() => {
    window.sliders.a!.goTo(3);
    window.sliders.b!.goTo(3);
  });
  await settled(page, "a");
  await settled(page, "b");
  expect(await state(page, "a")).toEqual({ index: 3, position: 1800 });
  expect(await state(page, "b")).toEqual({ index: 3, position: 1800 });
});

test("a negative maxDots shows every dot", async ({ page }) => {
  await mount(page, slider("s", 5));
  await create(page, "s", { maxDots: -2 });
  await expect(page.locator("#s .aero-slider__dot")).toHaveCount(5);
  await expect(page.locator("#s .aero-slider__pagination--windowed")).toHaveCount(0);
});

test("a non-finite autoplaySpeed uses the default speed", async ({ page }) => {
  await mount(page, slider("s", 5, { style: "--slides-per-view:2" }));
  await recordEvents(page, "s");
  await create(page, "s", { autoplay: "continuous", autoplaySpeed: NaN });
  expect(await takeEvents(page, "s")).toContain("autoplayStart");
});

test("unknown alignment and snap values fall back to their defaults", async ({ page }) => {
  await mount(page, slider("s", 5));
  await create(page, "s", { alignment: "middle" as never, snap: "magnetic" as never });
  await expect(page.locator("#s")).toHaveAttribute("data-aero-alignment", "center");
  await expect(page.locator("#s")).not.toHaveClass(/aero-slider--free/);
});

test("goTo() with a non-finite index does nothing", async ({ page }) => {
  await mount(page, slider("s", 5));
  await create(page, "s");
  await page.evaluate(() => window.sliders.s!.goTo(1, { instant: true }));
  await recordEvents(page, "s");
  await page.evaluate(() => {
    for (const index of [NaN, Infinity, -Infinity]) window.sliders.s!.goTo(index);
  });
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 1, position: 600 });
  const events = await takeEvents(page, "s");
  expect(events.filter((e) => e.startsWith("slideChange"))).toEqual([]);
});

test("an unknown direction follows the page", async ({ page }) => {
  await mount(page, slider("s", 5), { htmlAttributes: { dir: "rtl" } });
  await create(page, "s", { direction: "sideways" as never });
  await page.evaluate(() => window.sliders.s!.next());
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 1, position: -600 });
});

test("numbers passed as strings are read as numbers", async ({ page }) => {
  await mount(page, slider("s", 12));
  await create(page, "s", { perMove: "3", maxDots: "5" } as never);
  await expect(page.locator("#s .aero-slider__pagination")).toHaveClass(/--windowed/);
  await page.evaluate(() => window.sliders.s!.next());
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 3, position: 1800 });
});
