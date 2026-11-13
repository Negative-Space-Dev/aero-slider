import { type Page, create, expect, mount, settled, slider, test } from "./fixtures";
import { state } from "./helpers/state";

/** Slide 0's size and the space between slides 0 and 1 along the scroll axis, in px. */
const box = (page: Page, id = "s") =>
  page.evaluate((id) => {
    const [first, second] = Array.from(
      document.querySelectorAll(
        `#${id} > .aero-slider__viewport > .aero-slider__track > .aero-slider__slides > *`
      ),
      (slide) => slide.getBoundingClientRect()
    );
    return {
      width: Math.round(first!.width),
      height: Math.round(first!.height),
      gap: Math.round(Math.max(second!.left - first!.right, second!.top - first!.bottom)),
    };
  }, id);

const DEFAULT_BOX = { width: 600, height: 360, gap: 0 };

for (const [name, value, expected] of [
  ["slides-per-view", "2", { width: 300, height: 180, gap: 0 }],
  ["slide-gap", "10px", { width: 600, height: 360, gap: 10 }],
  ["slide-aspect", "2 / 1", { width: 600, height: 300, gap: 0 }],
] as const) {
  test(`--aero-${name} sizes slides`, async ({ page }) => {
    await mount(page, slider("s", 4, { style: `--aero-${name}:${value}` }));
    expect(await box(page)).toEqual(expected);
  });
}

test("a vertical slider reads the variables", async ({ page }) => {
  await mount(
    page,
    slider("s", 4, {
      style: "--aero-slides-per-view:2;--aero-slide-gap:10px;--aero-slide-aspect:2 / 1",
    })
  );
  await create(page, "s", { vertical: true });
  expect(await box(page)).toEqual({ width: 600, height: 145, gap: 10 });
});

test("cascade: with no variable set, the defaults apply", async ({ page }) => {
  await mount(page, slider("s", 4));
  expect(await box(page)).toEqual(DEFAULT_BOX);
});

test("cascade: a variable set inline beats one from a class rule", async ({ page }) => {
  await mount(
    page,
    slider("s", 6, {
      className: "themed",
      style: "--aero-slides-per-view:3;--aero-slide-gap:15px;--aero-slide-aspect:1",
    }),
    {
      head: `<style>.themed { --aero-slides-per-view: 2; --aero-slide-gap: 30px; --aero-slide-aspect: 3 / 1 }</style>`,
    }
  );
  expect(await box(page)).toEqual({ width: 190, height: 190, gap: 15 });
  await create(page, "s");
  await expect(page.locator("#s .aero-slider__dot")).toHaveCount(4);
});

test("cascade: variables set on an ancestor are inherited", async ({ page }) => {
  await mount(
    page,
    `<div style="--aero-slides-per-view:3;--aero-slide-gap:15px;--aero-slide-aspect:1">${slider("s", 6)}</div>`
  );
  expect(await box(page)).toEqual({ width: 190, height: 190, gap: 15 });
  await create(page, "s");
  await expect(page.locator("#s .aero-slider__dot")).toHaveCount(4);
});

// Generic names a host page sets for its own purposes never reach the slider.
test("unprefixed names are ignored", async ({ page }) => {
  await mount(
    page,
    slider("s", 6, { style: "--slides-per-view:3;--slide-gap:15px;--slide-aspect:1" })
  );
  expect(await box(page)).toEqual(DEFAULT_BOX);
  await create(page, "s");
  await expect(page.locator("#s .aero-slider__dot")).toHaveCount(6);
});

test("a nested slider keeps its own settings", async ({ page }) => {
  const inner = slider("inner", 2, {
    style: "--aero-slides-per-view:1;--aero-slide-gap:0px;--aero-slide-aspect:2 / 1",
    nav: false,
    dots: false,
  });
  await mount(
    page,
    slider("outer", 4, {
      style: "--aero-slides-per-view:3;--aero-slide-gap:12px;--aero-slide-aspect:1",
      inner: (i) => (i === 0 ? inner : `<div>${i}</div>`),
    })
  );
  await create(page, "outer");
  await create(page, "inner", { loop: true });
  expect(await box(page, "outer")).toEqual({ width: 192, height: 192, gap: 12 });
  expect(await box(page, "inner")).toEqual({ width: 192, height: 96, gap: 0 });
  await expect(page.locator("#inner [data-aero-slider-clone]")).toHaveCount(6);
});

test("a nested slider with no settings of its own starts from the defaults", async ({ page }) => {
  await mount(
    page,
    slider("outer", 4, {
      style: "--aero-slides-per-view:2;--aero-slide-gap:20px;--aero-slide-aspect:1",
      inner: (i) => (i === 0 ? slider("inner", 3, { nav: false, dots: false }) : `<div>${i}</div>`),
    })
  );
  expect(await box(page, "inner")).toEqual({ width: 290, height: 174, gap: 0 });
});

test("a slide that is itself a slider keeps the settings made on it", async ({ page }) => {
  const inner = slider("inner", 3, { style: "--aero-slides-per-view:2", nav: false, dots: false });
  await mount(
    page,
    `<div id="outer" class="aero-slider" style="width:600px"><div class="aero-slider__viewport"><div class="aero-slider__track"><div class="aero-slider__slides">${inner}<div>1</div></div></div></div></div>`
  );
  // The fixture's inline width keeps the inner slider 600px wide, so two per view are 300px each.
  expect((await box(page, "inner")).width).toBe(300);
});

test("a slide that is itself a slider ignores the outer slider's settings", async ({ page }) => {
  const inner = slider("inner", 3, {
    style: "--aero-slide-aspect:2 / 1",
    nav: false,
    dots: false,
  });
  await mount(
    page,
    `<div id="outer" class="aero-slider" style="width:600px;--aero-slides-per-view:3;--aero-slide-gap:12px;--aero-slide-aspect:1"><div class="aero-slider__viewport"><div class="aero-slider__track"><div class="aero-slider__slides">${inner}<div>1</div></div></div></div></div>`
  );
  expect(await box(page, "inner")).toEqual({ width: 600, height: 300, gap: 0 });
});

/** The resting position after each of `steps` presses of next(), then of goTo(index). */
async function walk(page: Page, steps: number, index: number) {
  const positions = [];
  for (let i = 0; i < steps; i++) {
    await page.evaluate(() => window.sliders.s!.next());
    await settled(page, "s");
    positions.push(await state(page, "s"));
  }
  await page.evaluate((index) => window.sliders.s!.goTo(index), index);
  await settled(page, "s");
  positions.push(await state(page, "s"));
  return positions;
}

test("a looping slider with fractional slides per view", async ({ page }) => {
  await mount(page, slider("s", 5, { style: "--aero-slides-per-view:1.5;--aero-slide-gap:8px" }));
  await create(page, "s", { loop: true });
  await expect(page.locator("#s [data-aero-slider-clone]")).toHaveCount(10);
  expect(await box(page)).toEqual({ width: 397, height: 238, gap: 8 });
});

test("a breakout slider steps by the layout column", async ({ page }) => {
  await mount(
    page,
    slider("s", 5, {
      className: "aero-slider--breakout",
      style:
        "width:1000px;--aero-layout-width:600px;--aero-slides-per-view:1.2;--aero-slide-gap:20px",
    })
  );
  await create(page, "s", { alignment: "start" });
  expect(await box(page)).toEqual({ width: 497, height: 298, gap: 20 });
  expect((await walk(page, 3, 1)).map((p) => p.position)).toEqual([517, 1033, 1550, 517]);
});

test("the pre-init loop spacer reserves the space the clones will take", async ({ page }) => {
  const offsets = [];
  for (const alignment of ["center", "end"]) {
    await mount(
      page,
      slider("s", 5, { style: "--aero-slides-per-view:1.5;--aero-slide-gap:8px" }).replace(
        'class="aero-slider',
        `data-aero-defer-visibility data-aero-alignment="${alignment}" class="aero-slider`
      )
    );
    offsets.push(
      await page.evaluate(() => {
        const track = document.querySelector("#s .aero-slider__track")!;
        const offset =
          track.querySelector(".aero-slider__slides")!.children[0]!.getBoundingClientRect().left -
          track.getBoundingClientRect().left;
        return Math.round(offset);
      })
    );
  }
  expect(offsets).toEqual([101, 203]);
});
