import { type Page, create, expect, mount, settled, slider, test } from "./fixtures";
import { state } from "./helpers/state";

const twoAndAHalf = { style: "--slides-per-view:2.5", dots: false };

const PAIRS = [
  ["start", "left"],
  ["end", "right"],
] as const;

/** Where slide 2 of 6 rests, 240px slides in a 600px track (144px of a 360px one vertically). */
const LAYOUTS = {
  ltr: { start: 480, center: 300, end: 120 },
  rtl: { start: -480, center: -300, end: -120 },
  vertical: { start: 288, center: 180, end: 72 },
} as const;

async function restingPosition(
  page: Page,
  layout: keyof typeof LAYOUTS,
  alignment: string
): Promise<number> {
  await mount(page, slider("s", 6, twoAndAHalf), {
    htmlAttributes: layout === "rtl" ? { dir: "rtl" } : {},
  });
  await create(page, "s", {
    alignment: alignment as never,
    direction: layout === "vertical" ? "ttb" : "auto",
  });
  await page.evaluate(() => window.sliders.s!.goTo(2, { instant: true }));
  await settled(page, "s");
  return (await state(page, "s")).position;
}

for (const layout of Object.keys(LAYOUTS) as (keyof typeof LAYOUTS)[]) {
  for (const [canonical, alias] of PAIRS) {
    test(`${layout}: "${alias}" rests where "${canonical}" does`, async ({ page }) => {
      expect(await restingPosition(page, layout, canonical)).toBe(LAYOUTS[layout][canonical]);
      expect(await restingPosition(page, layout, alias)).toBe(LAYOUTS[layout][canonical]);
    });
  }

  test(`${layout}: "center" rests in the middle`, async ({ page }) => {
    expect(await restingPosition(page, layout, "center")).toBe(LAYOUTS[layout].center);
  });
}

test("the container's data-aero-alignment holds the canonical value", async ({ page }) => {
  await mount(page, slider("s", 6, twoAndAHalf));
  const attribute = page.locator("#s");
  for (const [given, written] of [
    ["left", "start"],
    ["start", "start"],
    ["center", "center"],
    ["right", "end"],
    ["end", "end"],
  ]) {
    await create(page, "s", { alignment: given as never });
    await expect(attribute).toHaveAttribute("data-aero-alignment", written!);
  }
});

test("update({ alignment }) accepts either spelling and moves the resting place", async ({
  page,
}) => {
  await mount(page, slider("s", 6, twoAndAHalf));
  await create(page, "s", { alignment: "start" });
  await page.evaluate(() => window.sliders.s!.goTo(2, { instant: true }));
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 2, position: 480 });

  for (const [given, written, position] of [
    ["right", "end", 120],
    ["start", "start", 480],
    ["end", "end", 120],
    ["left", "start", 480],
    ["center", "center", 300],
  ] as const) {
    await page.evaluate((alignment) => window.sliders.s!.update({ alignment }), given);
    await settled(page, "s");
    await expect(page.locator("#s")).toHaveAttribute("data-aero-alignment", written);
    expect(await state(page, "s")).toEqual({ index: 2, position });
  }
});

test("start alignment with a whole number of slides per view still caps the last stop", async ({
  page,
}) => {
  await mount(page, slider("s", 6, { style: "--slides-per-view:3" }));
  await create(page, "s", { alignment: "start" });
  await expect(page.locator("#s .aero-slider__dot")).toHaveCount(4);
  await page.evaluate(() => window.sliders.s!.goTo(5));
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 3, position: 600 });
  await expect(page.locator("#s .aero-slider__nav--next")).toBeDisabled();
});

/** Distance from the track's start edge to slide 0, before any script runs. */
const preInitOffset = (page: Page) =>
  page.evaluate(() => {
    const track = document.querySelector("#s .aero-slider__track")!;
    return Math.round(
      track.children[0]!.getBoundingClientRect().left - track.getBoundingClientRect().left
    );
  });

for (const [values, offset] of [
  [["start", "left"], 0],
  [["end", "right"], 360],
  [["center"], 180],
] as const) {
  test(`pre-init spacer for data-aero-alignment="${values.join('" / "')}" is ${offset}px`, async ({
    page,
  }) => {
    for (const value of values) {
      await mount(
        page,
        slider("s", 6, twoAndAHalf).replace(
          'class="aero-slider',
          `data-aero-defer-visibility data-aero-alignment="${value}" class="aero-slider`
        )
      );
      expect(await preInitOffset(page)).toBe(offset);
    }
  });
}

test("legacy left/right markup snaps natively like start/end before init", async ({ page }) => {
  for (const [value, align] of [
    ["left", "start"],
    ["start", "start"],
    ["right", "end"],
    ["end", "end"],
  ]) {
    await mount(
      page,
      slider("s", 3).replace(
        'class="aero-slider',
        `data-aero-alignment="${value}" class="aero-slider`
      )
    );
    expect(
      await page.evaluate(
        () =>
          getComputedStyle(document.querySelector("#s .aero-slider__track > *")!).scrollSnapAlign
      )
    ).toBe(align);
  }
});
