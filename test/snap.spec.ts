import {
  type Page,
  create,
  expect,
  expectNear,
  failOnPageErrors,
  mount,
  nextFrame,
  recordScroll,
  settled,
  slider,
  state,
  test,
} from "./fixtures";

failOnPageErrors();

const STRIDE = 610;

const stepsOf = (path: number[]) =>
  path
    .slice(1)
    .map((p, k) => p - path[k]!)
    .filter((d) => d !== 0);

/**
 * Sets the track's offset as a user scroll would, then records it with its frame time on every
 * frame for `ms`.
 */
const scrollAndRecord = (page: Page, left: number, ms: number) =>
  page.evaluate(
    async ([left, ms]) => {
      const track = document.querySelector("#s .aero-slider__track")!;
      track.scrollLeft = left;
      const out: { time: number; offset: number }[] = [];
      const end = performance.now() + ms;
      while (performance.now() < end) {
        const time = await new Promise<number>(requestAnimationFrame);
        out.push({ time, offset: track.scrollLeft });
      }
      return out;
    },
    [left, ms] as const
  );

const setScroll = (page: Page, left: number) =>
  page.evaluate(
    (left) => (document.querySelector("#s .aero-slider__track")!.scrollLeft = left),
    left
  );

/** Presses at `from` px into the track, then moves the mouse to each x in `xs` a frame apart. */
async function drag(page: Page, from: number, xs: number[], framesPerMove = 1) {
  const box = (await page.locator("#s .aero-slider__track").boundingBox())!;
  const y = box.y + 50;
  await page.mouse.move(box.x + from, y);
  await page.mouse.down();
  for (const x of xs) {
    for (let f = 0; f < framesPerMove; f++) await nextFrame(page);
    await page.mouse.move(box.x + x, y);
  }
}

/** xs from `from` toward `to` in steps of `step`, excluding `from`. */
const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((from - to) / step) }, (_, i) => from - (i + 1) * step);

async function fiveSlides(page: Page, snap: "settle" | "none", scrollDuration = 300) {
  await mount(page, slider("s", 5, { style: "--slide-gap:10px" }));
  await create(page, "s", { snap, scrollDuration });
}

test("native snapping is the default", async ({ page }) => {
  await mount(page, slider("s", 3));
  await create(page, "s");
  await expect(page.locator("#s")).not.toHaveClass(/aero-slider--free/);
  await expect(page.locator("#s .aero-slider__track")).toHaveCSS("scroll-snap-type", /mandatory/);
});

for (const [name, config, style] of [
  ["settle", { snap: "settle" }, ""],
  ["none", { snap: "none" }, ""],
  ["settle on a vertical track", { snap: "settle", direction: "ttb" }, "height:300px"],
] as const) {
  test(`snap: ${name} turns CSS snapping off`, async ({ page }) => {
    await mount(page, slider("s", 4, { style }));
    await create(page, "s", config);
    await expect(page.locator("#s")).toHaveClass(/aero-slider--free/);
    await expect(page.locator("#s .aero-slider__track")).toHaveCSS("scroll-snap-type", "none");
  });
}

test.describe("snap: settle", () => {
  // Long enough that a busy headless browser still draws several frames of each ease.
  test.beforeEach(async ({ page }) => {
    await fiveSlides(page, "settle", 600);
  });

  test("a scroll stays where it stops, then eases onto the nearest slide", async ({ page }) => {
    const samples = await scrollAndRecord(page, 820, 700);
    const steps = samples
      .slice(1)
      .map(({ time, offset }, k) => ({
        d: offset - samples[k]!.offset,
        dt: time - samples[k]!.time,
      }))
      .filter(({ d }) => d !== 0);
    expectNear(samples[0]!.offset, 820);
    expect(steps.length).toBeGreaterThanOrEqual(6);
    expect(steps.every(({ d }) => d < 0)).toBe(true);
    // The largest step scaled to one 60Hz frame, so a frame the browser dropped isn't a jump. A
    // sample can show the previous frame's step, so scale by the longer of the two intervals.
    const biggest = Math.max(
      ...steps.map(
        ({ d, dt }, k) =>
          Math.abs(d) / Math.max(1, dt / (1000 / 60), (steps[k - 1]?.dt ?? 0) / (1000 / 60))
      )
    );
    expect(biggest).toBeLessThan(210 * 0.4);
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 1, position: STRIDE });
  });

  test("a mouse drag follows the pointer, and a still release eases onto a slide", async ({
    page,
  }) => {
    await drag(page, 500, range(500, 100, 20));
    expect((await state(page, "s")).position).toBe(400);
    // Long enough for the drag's velocity to decay to a dead stop.
    await page.waitForTimeout(250);
    const path = await recordScroll(page, "s", 600);
    await page.mouse.up();
    const steps = stepsOf(await path());
    expect(steps.length).toBeGreaterThanOrEqual(6);
    expect(steps.every((d) => d > 0)).toBe(true);
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 1, position: STRIDE });
  });

  // Firefox can skip scrollend after wheel scrolling; the wheel's own settle timer covers it.
  test("a wheel scroll settles even when scrollend never comes", async ({ page }) => {
    await page.evaluate(() => {
      const track = document.querySelector("#s .aero-slider__track")!;
      document
        .getElementById("s")!
        .addEventListener("scrollend", (e) => e.stopPropagation(), { capture: true });
      track.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaX: 1 }));
      track.scrollLeft = 820;
    });
    await expect.poll(() => state(page, "s")).toEqual({ index: 1, position: STRIDE });
  });

  test("a slow mouse release eases back onto the nearest slide", async ({ page }) => {
    await drag(page, 500, range(500, 410, 15), 2);
    await page.mouse.up();
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 0, position: 0 });
  });

  test("a wheel scroll moves freely, then eases back onto its slide", async ({ page }) => {
    const box = (await page.locator("#s .aero-slider__track").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 60);
    const path = await recordScroll(page, "s", 900);
    await page.mouse.wheel(200, 0);
    expect(Math.max(...(await path()))).toBeGreaterThan(120);
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 0, position: 0 });
  });
});

// Each move reaches the page about 35ms after the last, and a loaded machine stretches that, so
// the flick's speed varies. With two slides any flick can only carry to the next one; it releases
// short of the midpoint, so only its speed can carry it there.
test("snap: settle: a flick carries past the midpoint to the next slide", async ({ page }) => {
  await mount(page, slider("s", 2, { style: "--slide-gap:10px" }));
  await create(page, "s", { snap: "settle", scrollDuration: 600 });
  await drag(page, 590, range(590, 350, 60));
  await page.mouse.up();
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 1, position: STRIDE });
});

test.describe("snap: settle on a loop", () => {
  // Past the last real slide it eases onto the nearest slide on screen, a clone, then teleports to
  // the real copy. It never flies back across the track to get there.
  test("eases onto a clone past the end, then teleports to the real slide", async ({ page }) => {
    await mount(page, slider("s", 4, { style: "--slide-gap:10px" }));
    await create(page, "s", { loop: true, snap: "settle", scrollDuration: 300 });
    await page.evaluate(() => window.sliders.s!.goTo(3, { instant: true }));
    await settled(page, "s");
    const { from, clone, home } = await page.evaluate(() => {
      const kids = [...document.querySelector("#s .aero-slider__track")!.children] as HTMLElement[];
      const pos = (i: number) => kids[i]!.offsetLeft - kids[0]!.offsetLeft;
      const lastReal = kids.findLastIndex((k) => !k.hasAttribute("data-aero-slider-clone"));
      return { from: pos(lastReal) + 488, clone: pos(lastReal + 1), home: pos(lastReal - 3) };
    });

    const path = (await scrollAndRecord(page, from, 700)).map((s) => s.offset);
    const jump = path.findIndex((p, k) => k > 0 && Math.abs(p - path[k - 1]!) > 300);
    const before = jump < 0 ? path : path.slice(0, jump);
    const after = jump < 0 ? [] : path.slice(jump);
    expect(before.length).toBeGreaterThanOrEqual(6);
    expect(
      before.every((p, k) => p >= from - 1 && p <= clone + 1 && (k === 0 || p >= before[k - 1]!))
    ).toBe(true);
    expectNear(before.at(-1)!, clone, 4);
    expect(after.length).toBeGreaterThan(0);
    for (const p of after) expectNear(p, home);

    await settled(page, "s");
    const now = await state(page, "s");
    expect(now.index).toBe(0);
    expectNear(now.position, home);
  });

  // With fractional slides per view the end clones' snap points lie off the runway, so it settles
  // onto the real twin instead of waiting at an edge it can never leave.
  for (const edge of ["start", "end"] as const) {
    test(`with fractional slides in view, a scroll to the ${edge} settles onto a slide`, async ({
      page,
    }) => {
      await mount(page, slider("s", 4, { style: "--slides-per-view:1.5;--slide-gap:8px" }));
      await create(page, "s", { loop: true, snap: "settle", scrollDuration: 300 });
      await page.evaluate((edge) => {
        const track = document.querySelector("#s .aero-slider__track")!;
        track.scrollLeft = edge === "start" ? 0 : track.scrollWidth;
      }, edge);
      const rest = () =>
        page.evaluate(() => {
          const track = document.querySelector("#s .aero-slider__track")!;
          const r = track.getBoundingClientRect();
          const mid = r.left + r.width / 2;
          const off = Math.min(
            ...[...track.children].map((k) => {
              const b = k.getBoundingClientRect();
              return Math.abs(b.left + b.width / 2 - mid);
            })
          );
          return {
            centred: off < 1.5,
            onRunway:
              track.scrollLeft > 0 && track.scrollLeft < track.scrollWidth - track.clientWidth,
          };
        });
      await expect.poll(rest, { timeout: 5000 }).toEqual({ centred: true, onRunway: true });
    });
  }
});

test.describe("snap: none", () => {
  test.beforeEach(async ({ page }) => {
    await fiveSlides(page, "none");
  });

  test("the track rests wherever a scroll stops, and the index follows", async ({ page }) => {
    await setScroll(page, 820);
    await settled(page, "s");
    await page.waitForTimeout(400);
    expect(await state(page, "s")).toEqual({ index: 1, position: 820 });
  });

  test("a still mouse release rests where it was released", async ({ page }) => {
    await drag(page, 500, range(500, 100, 20));
    await page.waitForTimeout(250);
    await page.mouse.up();
    await settled(page, "s");
    expect((await state(page, "s")).position).toBe(400);
  });

  test("a flick coasts on its momentum and rests between slides", async ({ page }) => {
    await drag(page, 400, range(400, 280, 20));
    const path = await recordScroll(page, "s", 500);
    await page.mouse.up();
    const steps = stepsOf(await path());
    await settled(page, "s");
    const rest = (await state(page, "s")).position;
    expect(steps.length).toBeGreaterThanOrEqual(4);
    expect(steps.every((d) => d > 0)).toBe(true);
    expect(rest).toBeGreaterThan(170);
    expect(rest).toBeLessThan(560);
    expect(Math.abs(rest % STRIDE)).toBeGreaterThan(5);
  });

  test("a wheel scroll rests where it stops", async ({ page }) => {
    const box = (await page.locator("#s .aero-slider__track").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 60);
    await page.mouse.wheel(200, 0);
    await settled(page, "s");
    await page.waitForTimeout(300);
    const { position } = await state(page, "s");
    expect(position).toBeGreaterThan(120);
    expect(position).toBeLessThan(260);
  });
});

// It used to wait forever for a spot past the runway it couldn't reach.
test("snap: none on a loop: a fast flick near the end stays on the runway and keeps tracking", async ({
  page,
}) => {
  await mount(
    page,
    `<div style="padding-left:400px">${slider("s", 4, { style: "--slides-per-view:3;--slide-gap:10px" })}</div>`
  );
  await create(page, "s", { loop: true, snap: "none", scrollDuration: 550 });
  await page.evaluate(() => window.sliders.s!.goTo(3, { instant: true }));
  await settled(page, "s");

  await drag(page, 500, range(500, -340, 120));
  await page.mouse.up();
  await settled(page, "s");
  const runway = await page.evaluate(() => {
    const track = document.querySelector("#s .aero-slider__track")!;
    return { position: track.scrollLeft, max: track.scrollWidth - track.clientWidth };
  });
  expect(runway.position).toBeGreaterThan(1);
  expect(runway.position).toBeLessThan(runway.max - 1);

  await page.evaluate(() => {
    const track = document.querySelector<HTMLElement>("#s .aero-slider__track")!;
    const real1 = [...track.children].find(
      (k) => !k.hasAttribute("data-aero-slider-clone") && k.textContent === "1"
    ) as HTMLElement;
    track.scrollLeft +=
      real1.getBoundingClientRect().left +
      real1.offsetWidth / 2 -
      (track.getBoundingClientRect().left + track.clientWidth / 2);
  });
  await settled(page, "s");
  expect((await state(page, "s")).index).toBe(1);
});
