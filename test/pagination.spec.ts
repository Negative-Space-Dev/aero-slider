import {
  type Page,
  create,
  expect,
  failOnPageErrors,
  mount,
  settled,
  slider,
  state,
  test,
} from "./fixtures";

failOnPageErrors();

/** One letter per dot: A active, _ hidden, e edge, n near the edge, . full size. */
const dotSizes = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("#s .aero-slider__pagination .aero-slider__dot")]
      .map((d) =>
        d.classList.contains("aero-slider__dot--active")
          ? "A"
          : d.classList.contains("aero-slider__dot--hidden")
            ? "_"
            : d.classList.contains("aero-slider__dot--edge")
              ? "e"
              : d.classList.contains("aero-slider__dot--near-edge")
                ? "n"
                : "."
      )
      .join("")
  );

test.describe("twelve slides, three in view, two per move, at most five dots", () => {
  test.beforeEach(async ({ page }) => {
    await mount(page, slider("s", 12, { style: "--aero-slides-per-view:3;--aero-slide-gap:6px" }));
    await create(page, "s", { loop: true, perMove: 2, maxDots: 5 });
  });

  test("shows a window of five dots, shrinking toward the far edge", async ({ page }) => {
    await expect(page.locator("#s .aero-slider__pagination")).toHaveClass(
      /aero-slider__pagination--windowed/
    );
    expect(await dotSizes(page)).toBe("A..ne_______");
  });

  test("next() moves perMove slides", async ({ page }) => {
    await page.evaluate(() => window.sliders.s!.next());
    await settled(page, "s");
    expect((await state(page, "s")).index).toBe(2);
  });

  test("the window slides to keep the active dot in the middle", async ({ page }) => {
    await page.evaluate(() => window.sliders.s!.goTo(6));
    await expect.poll(() => dotSizes(page)).toBe("____enAne___");
    const offset = await page.evaluate(() => {
      const dots = document.querySelectorAll<HTMLElement>(
        "#s .aero-slider__pagination .aero-slider__dot"
      );
      return {
        pitch: dots[1]!.offsetLeft - dots[0]!.offsetLeft,
        offsets: [...new Set(Array.from(dots, (dot) => dot.style.translate))],
      };
    });
    expect(offset.offsets).toEqual([`-${4 * offset.pitch}px`]);
  });
});
