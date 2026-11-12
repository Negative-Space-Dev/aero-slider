import { type Page, create, expect, mount, settled, slider, test } from "./fixtures";
import { state } from "./helpers/state";

/** Slide 0's size and the space between slides 0 and 1 along the scroll axis, in px. */
const box = (page: Page, id = "s") =>
  page.evaluate((id) => {
    const [first, second] = Array.from(
      document.querySelectorAll(`#${id} > .aero-slider__viewport > .aero-slider__track > *`),
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
  test(`--aero-${name} sizes slides as --${name} does`, async ({ page }) => {
    for (const property of [`--${name}`, `--aero-${name}`]) {
      await mount(page, slider("s", 4, { style: `${property}:${value}` }));
      expect(await box(page)).toEqual(expected);
    }
  });
}

test("a vertical slider reads the new names as it reads the old", async ({ page }) => {
  const results = [];
  for (const prefix of ["--", "--aero-"]) {
    await mount(
      page,
      slider("s", 4, {
        style: `${prefix}slides-per-view:2;${prefix}slide-gap:10px;${prefix}slide-aspect:2 / 1`,
      })
    );
    await create(page, "s", { direction: "ttb" });
    results.push(await box(page));
  }
  expect(results).toEqual([
    { width: 600, height: 145, gap: 10 },
    { width: 600, height: 145, gap: 10 },
  ]);
});

test("cascade: with neither name set, the defaults apply", async ({ page }) => {
  await mount(page, slider("s", 4));
  expect(await box(page)).toEqual(DEFAULT_BOX);
});

test("cascade: a new name set inline beats an old name from a class rule", async ({ page }) => {
  await mount(
    page,
    slider("s", 6, {
      className: "themed",
      style: "--aero-slides-per-view:3;--aero-slide-gap:15px;--aero-slide-aspect:1",
    }),
    {
      head: `<style>.themed { --slides-per-view: 2; --slide-gap: 30px; --slide-aspect: 3 / 1 }</style>`,
    }
  );
  expect(await box(page)).toEqual({ width: 190, height: 190, gap: 15 });
  await create(page, "s");
  await expect(page.locator("#s .aero-slider__dot")).toHaveCount(4);
});

test("cascade: an old name in a class rule after the library still applies", async ({ page }) => {
  await mount(page, slider("s", 6, { className: "themed" }), {
    head: `<style>.themed { --slides-per-view: 3; --slide-gap: 30px; --slide-aspect: 3 / 1 }</style>`,
  });
  expect(await box(page)).toEqual({ width: 180, height: 60, gap: 30 });
  await create(page, "s");
  await expect(page.locator("#s .aero-slider__dot")).toHaveCount(4);
});

test("cascade: new names set on an ancestor are inherited", async ({ page }) => {
  await mount(
    page,
    `<div style="--aero-slides-per-view:3;--aero-slide-gap:15px;--aero-slide-aspect:1">${slider("s", 6)}</div>`
  );
  expect(await box(page)).toEqual({ width: 190, height: 190, gap: 15 });
  await create(page, "s");
  await expect(page.locator("#s .aero-slider__dot")).toHaveCount(4);
});

// Unchanged from before the rename: generic names a host page sets for its own purposes never
// reach the slider, which resets them on its container.
test("cascade: old names set on an ancestor are not inherited", async ({ page }) => {
  await mount(
    page,
    `<div style="--slides-per-view:3;--slide-gap:15px;--slide-aspect:1">${slider("s", 6)}</div>`
  );
  expect(await box(page)).toEqual(DEFAULT_BOX);
  await create(page, "s");
  await expect(page.locator("#s .aero-slider__dot")).toHaveCount(6);
});

// The outer slider's new names would otherwise be inherited by the inner one and beat the old
// names set on it, so moving only the outer slider to the new names would resize the inner one.
for (const prefix of ["--", "--aero-"]) {
  test(`a nested slider keeps its own settings when the outer one uses ${prefix}names`, async ({
    page,
  }) => {
    const inner = slider("inner", 2, {
      style: "--slides-per-view:1;--slide-gap:0px;--slide-aspect:2 / 1",
      nav: false,
      dots: false,
    });
    await mount(
      page,
      slider("outer", 4, {
        style: `${prefix}slides-per-view:3;${prefix}slide-gap:12px;${prefix}slide-aspect:1`,
        inner: (i) => (i === 0 ? inner : `<div>${i}</div>`),
      })
    );
    await create(page, "outer");
    await create(page, "inner", { loop: true });
    expect(await box(page, "outer")).toEqual({ width: 192, height: 192, gap: 12 });
    expect(await box(page, "inner")).toEqual({ width: 192, height: 96, gap: 0 });
    await expect(page.locator("#inner [data-aero-slider-clone]")).toHaveCount(6);
  });
}

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

test("a looping slider moves identically with old and new names", async ({ page }) => {
  const runs = [];
  for (const prefix of ["--", "--aero-"]) {
    await mount(
      page,
      slider("s", 5, { style: `${prefix}slides-per-view:1.5;${prefix}slide-gap:8px` })
    );
    await create(page, "s", { loop: true });
    runs.push({
      clones: await page.locator("#s [data-aero-slider-clone]").count(),
      box: await box(page),
      positions: await walk(page, 6, 2),
    });
  }
  expect(runs[1]).toEqual(runs[0]);
  expect(runs[0]!.clones).toBe(10);
  expect(runs[0]!.box).toEqual({ width: 397, height: 238, gap: 8 });
});

test("a breakout slider moves identically with old and new names", async ({ page }) => {
  const runs = [];
  for (const prefix of ["--", "--aero-"]) {
    await mount(
      page,
      slider("s", 5, {
        className: "aero-slider--breakout",
        style: `width:1000px;--aero-layout-width:600px;${prefix}slides-per-view:1.2;${prefix}slide-gap:20px`,
      })
    );
    await create(page, "s", { alignment: "start" });
    runs.push({ box: await box(page), positions: await walk(page, 3, 1) });
  }
  expect(runs[1]).toEqual(runs[0]);
  expect(runs[0]!.box).toEqual({ width: 497, height: 298, gap: 20 });
  expect(runs[0]!.positions.map((p) => p.position)).toEqual([517, 1033, 1550, 517]);
});

test("the pre-init loop spacer reserves the same space with old and new names", async ({
  page,
}) => {
  const offsets = [];
  for (const prefix of ["--", "--aero-"]) {
    for (const alignment of ["center", "end"]) {
      await mount(
        page,
        slider("s", 5, {
          style: `${prefix}slides-per-view:1.5;${prefix}slide-gap:8px`,
        }).replace(
          'class="aero-slider',
          `data-aero-defer-visibility data-aero-alignment="${alignment}" class="aero-slider`
        )
      );
      offsets.push(
        await page.evaluate(() => {
          const track = document.querySelector("#s .aero-slider__track")!;
          const offset =
            track.children[0]!.getBoundingClientRect().left - track.getBoundingClientRect().left;
          return Math.round(offset);
        })
      );
    }
  }
  expect(offsets).toEqual([101, 203, 101, 203]);
});
