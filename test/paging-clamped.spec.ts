import { type Page, create, expect, mount, settled, slider, test } from "./fixtures";
import { recordEvents, state, takeEvents } from "./helpers/state";

const threeUp = { style: "--aero-slides-per-view:3" };

async function press(page: Page, button: "prev" | "next") {
  await page.locator(`#s .aero-slider__nav--${button}`).click();
  await settled(page, "s");
  return state(page, "s");
}

const activeDot = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("#s .aero-slider__dot"))
      .filter((dot) => dot.style.display !== "none")
      .findIndex((dot) => dot.classList.contains("aero-slider__dot--active"))
  );

test("centred, 6 slides at 3 per view: every press moves, one dot per stop", async ({ page }) => {
  await mount(page, slider("s", 6, threeUp));
  await create(page, "s");
  const next = page.locator("#s .aero-slider__nav--next");
  const prev = page.locator("#s .aero-slider__nav--prev");
  await expect(page.locator("#s .aero-slider__dot")).toHaveCount(4);
  await expect(prev).toBeDisabled();

  expect(await press(page, "next")).toEqual({ index: 2, position: 200 });
  expect(await activeDot(page)).toBe(1);
  expect(await press(page, "next")).toEqual({ index: 3, position: 400 });
  expect(await press(page, "next")).toEqual({ index: 4, position: 600 });
  expect(await activeDot(page)).toBe(3);
  await expect(next).toBeDisabled();

  expect(await press(page, "prev")).toEqual({ index: 3, position: 400 });
  expect(await press(page, "prev")).toEqual({ index: 2, position: 200 });
  expect(await press(page, "prev")).toEqual({ index: 0, position: 0 });
  await expect(prev).toBeDisabled();

  const visits = [];
  for (const dot of await page.locator("#s .aero-slider__dot").all()) {
    await dot.click();
    await settled(page, "s");
    visits.push(await state(page, "s"));
  }
  expect(visits).toEqual([
    { index: 0, position: 0 },
    { index: 2, position: 200 },
    { index: 3, position: 400 },
    { index: 4, position: 600 },
  ]);
});

test("goTo() a slide that shares the last stop lights the last dot", async ({ page }) => {
  await mount(page, slider("s", 6, threeUp));
  await create(page, "s");
  await page.evaluate(() => window.sliders.s!.goTo(5));
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 5, position: 600 });
  expect(await activeDot(page)).toBe(3);
  await expect(page.locator("#s .aero-slider__nav--next")).toBeDisabled();
  expect(await press(page, "prev")).toEqual({ index: 3, position: 400 });
});

test("right-aligned, 6 slides at 3 per view, mirrors the centred case", async ({ page }) => {
  await mount(page, slider("s", 6, threeUp));
  await create(page, "s", { alignment: "end" });
  await expect(page.locator("#s .aero-slider__dot")).toHaveCount(4);
  expect(await press(page, "next")).toEqual({ index: 3, position: 200 });
  expect(await press(page, "next")).toEqual({ index: 4, position: 400 });
  expect(await press(page, "next")).toEqual({ index: 5, position: 600 });
  await expect(page.locator("#s .aero-slider__nav--next")).toBeDisabled();
  expect(await press(page, "prev")).toEqual({ index: 4, position: 400 });
  expect(await press(page, "prev")).toEqual({ index: 3, position: 200 });
  expect(await press(page, "prev")).toEqual({ index: 0, position: 0 });
  await expect(page.locator("#s .aero-slider__nav--prev")).toBeDisabled();
});

test("2 slides at 3 per view have a single stop", async ({ page }) => {
  await mount(page, slider("s", 2, threeUp));
  await create(page, "s");
  await expect(page.locator("#s .aero-slider__dot")).toHaveCount(1);
  await expect(page.locator("#s .aero-slider__nav--next")).toBeDisabled();
  await expect(page.locator("#s .aero-slider__nav--prev")).toBeDisabled();
  await recordEvents(page, "s");
  await page.evaluate(() => window.sliders.s!.next());
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 0, position: 0 });
  expect((await takeEvents(page, "s")).filter((e) => e.startsWith("slideChange"))).toEqual([]);
});

test("left-aligned, 6 slides at 3 per view, stops at slide 3 as before", async ({ page }) => {
  await mount(page, slider("s", 6, threeUp));
  await create(page, "s", { alignment: "start" });
  await expect(page.locator("#s .aero-slider__dot")).toHaveCount(4);
  expect(await press(page, "next")).toEqual({ index: 1, position: 200 });
  expect(await press(page, "next")).toEqual({ index: 2, position: 400 });
  expect(await press(page, "next")).toEqual({ index: 3, position: 600 });
  await expect(page.locator("#s .aero-slider__nav--next")).toBeDisabled();
  await page.evaluate(() => window.sliders.s!.goTo(5));
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 3, position: 600 });
});

test("one slide per view keeps a stop per slide", async ({ page }) => {
  await mount(page, slider("s", 4));
  await create(page, "s");
  await expect(page.locator("#s .aero-slider__dot")).toHaveCount(4);
  expect(await press(page, "next")).toEqual({ index: 1, position: 600 });
  expect(await press(page, "next")).toEqual({ index: 2, position: 1200 });
  expect(await press(page, "next")).toEqual({ index: 3, position: 1800 });
  await expect(page.locator("#s .aero-slider__nav--next")).toBeDisabled();
});

test("interval autoplay wraps after the last stop", async ({ page }) => {
  await mount(page, slider("s", 6, threeUp));
  await recordEvents(page, "s");
  await create(page, "s", { autoplay: true, autoplayInterval: 100 });
  const changes = async () =>
    (await page.evaluate(() => window.events.s!)).filter((e) => e.startsWith("slideChange"));
  await expect.poll(async () => (await changes()).length).toBeGreaterThanOrEqual(4);
  expect((await changes()).slice(0, 4)).toEqual([
    "slideChange:2",
    "slideChange:3",
    "slideChange:4",
    "slideChange:0",
  ]);
});

test("windowed dots slide in stop positions", async ({ page }) => {
  await mount(page, slider("s", 12, { style: "--aero-slides-per-view:3" }));
  await create(page, "s", { maxDots: 5 });
  await expect(page.locator("#s .aero-slider__dot:visible")).toHaveCount(10);
  await page.evaluate(() => window.sliders.s!.goTo(11, { instant: true }));
  expect(await activeDot(page)).toBe(9);
  const sizes = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#s .aero-slider__pagination .aero-slider__dot"), (dot) =>
      dot.className.replace(/aero-slider__dot\s*/, "").trim()
    )
  );
  expect(sizes.slice(5)).toEqual([
    "aero-slider__dot--edge",
    "aero-slider__dot--near-edge",
    "",
    "",
    "aero-slider__dot--active",
  ]);
});

test("a resize keeps a requested slide that shares the last stop", async ({ page }) => {
  await mount(page, slider("s", 6, { style: "--aero-slides-per-view:3" }));
  await create(page, "s");
  await page.evaluate(() => window.sliders.s!.goTo(5, { instant: true }));
  await settled(page, "s");
  expect((await state(page, "s")).index).toBe(5);
  await recordEvents(page, "s");
  await page.evaluate(() => (document.getElementById("s")!.style.width = "540px"));
  await expect.poll(async () => (await state(page, "s")).position).toBe(540);
  await settled(page, "s");
  expect((await state(page, "s")).index).toBe(5);
  expect((await takeEvents(page, "s")).filter((e) => e.startsWith("slideChange"))).toEqual([]);
});

// Each slide grows by 0.4px, which whole-pixel sizes don't show, and the last slide moves 40px.
test("a resize by a fraction of a pixel re-measures the slides", async ({ page }) => {
  await mount(page, slider("s", 100, { dots: false }));
  await create(page, "s", { snap: "none" });
  await settled(page, "s");
  await page.evaluate(() => (document.getElementById("s")!.style.width = "600.4px"));
  await settled(page, "s");
  await page.evaluate(() => window.sliders.s!.goTo(99, { instant: true }));
  await settled(page, "s");
  const { index, position } = await state(page, "s");
  expect(index).toBe(99);
  // WebKit lays out in 64ths of a pixel and scrolls in whole ones, so allow a few pixels.
  expect(Math.abs(position - 99 * 600.4)).toBeLessThan(3);
});
