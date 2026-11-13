import { type Page, create, expect, mount, slider, test } from "./fixtures";

/** What the windowed pagination of `#id` shows: its window width and how far its dots slide. */
const dotWindow = (page: Page, id: string) =>
  page.evaluate((id) => {
    const box = document.querySelector<HTMLElement>(`#${id} .aero-slider__pagination`)!;
    const dot = box.querySelector<HTMLElement>(".aero-slider__dot")!;
    return {
      width: box.style.getPropertyValue("--pagination-width"),
      offset: dot.style.translate,
    };
  }, id);

test("windowed dots made while hidden match once shown", async ({ page }) => {
  await mount(page, slider("shown", 12) + `<div id="wrap" hidden>${slider("hidden", 12)}</div>`);
  await create(page, "shown", { maxDots: 5 });
  await create(page, "hidden", { maxDots: 5 });
  await page.evaluate(() => {
    window.sliders.shown!.goTo(8, { instant: true });
    window.sliders.hidden!.goTo(8, { instant: true });
    document.getElementById("wrap")!.hidden = false;
  });
  const expected = await dotWindow(page, "shown");
  expect(expected.width).not.toBe("0px");
  await expect.poll(() => dotWindow(page, "hidden")).toEqual(expected);
});
