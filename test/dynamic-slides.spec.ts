import { type Page, create, expect, mount, settled, slider, test } from "./fixtures";
import { recordEvents, state, takeEvents } from "./helpers/state";

/** The label of the real slide resting at the track's start edge. */
const showing = (page: Page) =>
  page.evaluate(() => {
    const track = document.querySelector<HTMLElement>("#s .aero-slider__track")!;
    const left = track.getBoundingClientRect().left;
    const slides = Array.from(
      track.querySelectorAll<HTMLElement>(":scope > :not([data-aero-slider-clone])")
    );
    return slides.find((slide) => Math.abs(slide.getBoundingClientRect().left - left) < 2)
      ?.textContent;
  });

test.describe("on slide 2 of 5", () => {
  test.beforeEach(async ({ page }) => {
    await mount(page, slider("s", 5));
    await create(page, "s");
    await page.evaluate(() => window.sliders.s!.goTo(2, { instant: true }));
    await recordEvents(page, "s");
  });

  test("remove(0) keeps the same slide in view", async ({ page }) => {
    await page.evaluate(() => window.sliders.s!.remove(0));
    expect(await state(page, "s")).toEqual({ index: 1, position: 600 });
    expect(await showing(page)).toBe("2");
    expect(await takeEvents(page, "s")).toContain("slideChange:1");
  });

  test("add(slide, 0) keeps the same slide in view", async ({ page }) => {
    await page.evaluate(() => {
      const slide = document.createElement("div");
      slide.innerHTML = "<div>new</div>";
      window.sliders.s!.add(slide, 0);
    });
    expect(await state(page, "s")).toEqual({ index: 3, position: 1800 });
    expect(await showing(page)).toBe("2");
    expect(await takeEvents(page, "s")).toContain("slideChange:3");
  });

  test("appending a slide leaves the index alone", async ({ page }) => {
    await page.evaluate(() => {
      const slide = document.createElement("div");
      slide.innerHTML = "<div>new</div>";
      window.sliders.s!.add(slide);
    });
    expect(await state(page, "s")).toEqual({ index: 2, position: 1200 });
    expect(await takeEvents(page, "s")).not.toContainEqual(expect.stringMatching(/slideChange/));
  });

  test("removing the slide in view shows the one that takes its place", async ({ page }) => {
    await page.evaluate(() => window.sliders.s!.remove(2));
    expect(await state(page, "s")).toEqual({ index: 2, position: 1200 });
    expect(await showing(page)).toBe("3");
  });
});

test("removing the last slide while on it announces the new index", async ({ page }) => {
  await mount(page, slider("s", 5));
  await create(page, "s");
  await page.evaluate(() => window.sliders.s!.goTo(4, { instant: true }));
  await recordEvents(page, "s");
  await page.evaluate(() => window.sliders.s!.remove(4));
  expect(await state(page, "s")).toEqual({ index: 3, position: 1800 });
  expect(await takeEvents(page, "s")).toContain("slideChange:3");
  await expect(page.locator("#s .aero-slider__nav--next")).toBeDisabled();
  await expect(page.locator("#s .aero-slider__dot").nth(3)).toHaveClass(/--active/);
});

test("a resize that lowers the last stop announces the new index", async ({ page }) => {
  await mount(page, slider("s", 6, { style: "--slides-per-view:2" }));
  await create(page, "s", { alignment: "left" });
  await page.evaluate(() => window.sliders.s!.goTo(4, { instant: true }));
  await recordEvents(page, "s");
  await page.evaluate(() =>
    document.getElementById("s")!.style.setProperty("--slides-per-view", "3")
  );
  await expect.poll(() => page.evaluate(() => window.events.s)).toContain("slideChange:3");
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 3, position: 600 });
  await expect(page.locator("#s .aero-slider__nav--next")).toBeDisabled();
  await expect(page.locator("#s .aero-slider__dot")).toHaveCount(4);
});

test("synced thumbnails follow a slide removed from both", async ({ page }) => {
  await mount(page, slider("s", 5) + slider("thumbs", 5, { style: "--slides-per-view:5" }));
  await create(page, "s");
  await create(page, "thumbs");
  await page.evaluate(() => {
    window.syncThumbnails(window.sliders.s!, window.sliders.thumbs!);
    window.sliders.s!.goTo(2, { instant: true });
    window.sliders.thumbs!.remove(0);
    window.sliders.s!.remove(0);
  });
  await expect(page.locator("#thumbs .aero-slider__thumb--active")).toHaveText("2");
  expect(await page.evaluate(() => window.sliders.thumbs!.currentIndex)).toBe(1);
});
