import {
  type Page,
  create,
  expect,
  failOnPageErrors,
  mount,
  onSteadyFrames,
  recordEvents,
  recordScroll,
  settled,
  slider,
  state,
  test,
} from "./fixtures";

failOnPageErrors();

const STRIDE = 610;
const END = 4 * STRIDE;

async function fiveSlides(page: Page): Promise<void> {
  await mount(page, slider("s", 5, { style: "--aero-slide-gap:10px" }));
  await create(page, "s");
}

async function goTo(page: Page, index: number): Promise<void> {
  await page.evaluate((index) => window.sliders.s!.goTo(index), index);
  await settled(page, "s");
}

test("next and prev move the track one slide", async ({ page }) => {
  await fiveSlides(page);

  await page.evaluate(() => window.sliders.s!.next());
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 1, position: STRIDE });

  await page.evaluate(() => window.sliders.s!.prev());
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 0, position: 0 });
});

test("the track lets vertical scrolling chain to the page", async ({ page }) => {
  await fiveSlides(page);
  await expect(page.locator("#s .aero-slider__track")).toHaveCSS("overscroll-behavior-y", "auto");
});

test("goTo() the last slide reaches the end of the track and disables next", async ({ page }) => {
  await fiveSlides(page);
  await goTo(page, 4);
  expect(await state(page, "s")).toEqual({ index: 4, position: END });
  await expect(page.locator("#s .aero-slider__nav--next")).toBeDisabled();
});

test("ArrowLeft goes back one slide", async ({ page }) => {
  await fiveSlides(page);
  await goTo(page, 4);
  await page.locator("#s").focus();
  await page.keyboard.press("ArrowLeft");
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 3, position: 3 * STRIDE });
});

test("the prev button goes back one slide", async ({ page }) => {
  await fiveSlides(page);
  await goTo(page, 3);
  await page.locator("#s .aero-slider__nav--prev").click();
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 2, position: 2 * STRIDE });
});

test("a scroll by the user updates the index", async ({ page }) => {
  await fiveSlides(page);
  await goTo(page, 2);
  await page.evaluate(() => (document.querySelector("#s .aero-slider__track")!.scrollLeft = 0));
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 0, position: 0 });
});

test("slideChange fires once per change and the active dot follows", async ({ page }) => {
  await fiveSlides(page);
  const changes = await recordEvents(page, "s", ["slideChange"]);
  await page.evaluate(() => window.sliders.s!.next());
  await settled(page, "s");
  await goTo(page, 4);
  await page.locator("#s").focus();
  await page.keyboard.press("ArrowLeft");
  await settled(page, "s");
  await page.locator("#s .aero-slider__nav--prev").click();
  await settled(page, "s");
  await page.evaluate(() => (document.querySelector("#s .aero-slider__track")!.scrollLeft = 0));
  await settled(page, "s");

  expect(await changes()).toEqual([
    "slideChange1",
    "slideChange4",
    "slideChange3",
    "slideChange2",
    "slideChange0",
  ]);
  const dots = page.locator("#s .aero-slider__dot");
  await expect(dots).toHaveCount(5);
  await expect(dots.nth(0)).toHaveClass(/aero-slider__dot--active/);
  await expect(page.locator("#s .aero-slider__dot--active")).toHaveCount(1);
});

test("a dot click goes to its slide", async ({ page }) => {
  await fiveSlides(page);
  await page.locator("#s .aero-slider__dot").nth(2).click();
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 2, position: 2 * STRIDE });
});

test("goTo() with instant jumps there in the same task", async ({ page }) => {
  await fiveSlides(page);
  const jumped = await page.evaluate(() => {
    window.sliders.s!.goTo(3, { instant: true });
    const track = document.querySelector("#s .aero-slider__track")!;
    return { index: window.sliders.s!.currentIndex, position: track.scrollLeft };
  });
  expect(jumped).toEqual({ index: 3, position: 3 * STRIDE });
});

test("after an instant jump, next() still scrolls smoothly", async ({ page }) => {
  await onSteadyFrames(page, async () => {
    await fiveSlides(page);
    await page.evaluate(() => window.sliders.s!.goTo(3, { instant: true }));
    await settled(page, "s");

    const path = await recordScroll(page, "s", 500);
    await page.evaluate(() => window.sliders.s!.next());
    const samples = await path();
    const between = samples.filter((p) => p > 3 * STRIDE + 1 && p < END - 1);
    expect(new Set(between).size).toBeGreaterThanOrEqual(3);
    expect(samples.every((p, k) => k === 0 || p >= samples[k - 1]!)).toBe(true);

    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 4, position: END });
  });
});

test("an instant goTo() back to the start cancels a smooth move before it leaves", async ({
  page,
}) => {
  await fiveSlides(page);
  await page.evaluate(() => {
    window.sliders.s!.goTo(3);
    window.sliders.s!.goTo(0, { instant: true });
  });
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 0, position: 0 });
});

test("a smooth goTo() back to the start cancels a smooth move before it leaves", async ({
  page,
}) => {
  await fiveSlides(page);
  await page.evaluate(() => {
    window.sliders.s!.goTo(3);
    window.sliders.s!.goTo(0);
  });
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 0, position: 0 });
});
