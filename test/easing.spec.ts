import {
  type Page,
  create,
  expect,
  expectNear,
  failOnPageErrors,
  mount,
  onSteadyFrames,
  settled,
  slider,
  state,
  test,
} from "./fixtures";

failOnPageErrors();

const STRIDE = 610;

const FRAME_MS = 1000 / 60;

/**
 * Calls goTo(index) on `#s` and records the track's offset with its frame time on every frame for
 * `ms`. Also returns the track's inline scroll-snap-type straight after the call.
 */
const glideTo = (page: Page, index: number, ms: number) =>
  page.evaluate(
    async ([index, ms]) => {
      const track = document.querySelector<HTMLElement>("#s .aero-slider__track")!;
      window.sliders.s!.goTo(index);
      const snap = track.style.scrollSnapType;
      const samples: [time: number, offset: number][] = [];
      const end = performance.now() + ms;
      while (performance.now() < end) {
        const time = await new Promise<number>(requestAnimationFrame);
        samples.push([time, track.scrollLeft]);
      }
      return { snap, samples };
    },
    [index, ms] as const
  );

/**
 * How a recorded scroll from `from` to `to` moved. `biggest` is the largest step as a share of the
 * distance, scaled to one 60Hz frame, so a frame the browser dropped doesn't read as a jump. A
 * sample can show the previous frame's step, so each step is scaled by the longer of its own and
 * the previous frame interval.
 */
function glide(samples: [number, number][], from: number, to: number) {
  const steps = samples
    .slice(1)
    .map(([time, offset], k) => ({ d: offset - samples[k]![1], dt: time - samples[k]![0] }))
    .filter(({ d }) => d !== 0);
  const half = Math.floor(steps.length / 2);
  const speed = (a: typeof steps) =>
    Math.abs(a.reduce((x, s) => x + s.d, 0)) / (a.reduce((x, s) => x + s.dt, 0) || 1);
  return {
    steps: steps.length,
    oneWay: steps.every(({ d }) => Math.sign(d) === Math.sign(to - from)),
    biggest:
      Math.max(
        0,
        ...steps.map(
          ({ d, dt }, k) =>
            Math.abs(d) / Math.max(1, dt / FRAME_MS, (steps[k - 1]?.dt ?? 0) / FRAME_MS)
        )
      ) / Math.abs(to - from),
    firstHalf: speed(steps.slice(0, half)),
    secondHalf: speed(steps.slice(half)),
  };
}

/** The default ease-out covers most of the distance in the first half, at about 7 times the pace. */
function expectEvenPace({ firstHalf, secondHalf }: ReturnType<typeof glide>): void {
  expect(firstHalf / secondHalf).toBeGreaterThan(0.6);
  expect(firstHalf / secondHalf).toBeLessThan(1.6);
}

async function eased(page: Page, scrollDuration: number): Promise<void> {
  await mount(page, slider("s", 5, { style: "--slide-gap:10px" }));
  await create(page, "s", { scrollDuration });
}

const snapStyle = (page: Page) =>
  page.locator("#s .aero-slider__track").evaluate((t: HTMLElement) => t.style.scrollSnapType);

// Snapping left on would pull every frame to a slide, so the path would jump 0, 610, 1220. The
// durations leave a busy headless browser enough frames to count.
test("scrollDuration eases goTo() out over its own timeline, with snapping off until it lands", async ({
  page,
}) => {
  await onSteadyFrames(page, async () => {
    await eased(page, 600);
    const { snap, samples } = await glideTo(page, 2, 800);
    expect(snap).toBe("none");
    const g = glide(samples, 0, 2 * STRIDE);
    expect(g.steps).toBeGreaterThanOrEqual(8);
    expect(g.oneWay).toBe(true);
    expect(g.biggest).toBeLessThan(0.3);
    expect(g.firstHalf).toBeGreaterThan(g.secondHalf);

    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 2, position: 2 * STRIDE });
    expect(await snapStyle(page)).toBe("");
  });
});

test("scrollEasing shapes the curve: linear moves in even steps, both ways", async ({ page }) => {
  await onSteadyFrames(page, async () => {
    await mount(page, slider("s", 5, { style: "--slide-gap:10px" }));
    await page.evaluate(() => {
      window.sliders.s = window.createSlider(document.getElementById("s")!, {
        scrollDuration: 800,
        scrollEasing: (t) => t,
      });
    });

    const forward = glide((await glideTo(page, 2, 1000)).samples, 0, 2 * STRIDE);
    expect(forward.steps).toBeGreaterThanOrEqual(12);
    expect(forward.oneWay).toBe(true);
    expect(forward.biggest).toBeLessThan(0.15);
    expectEvenPace(forward);
    await settled(page, "s");
    expect((await state(page, "s")).position).toBe(2 * STRIDE);

    const back = glide((await glideTo(page, 0, 1000)).samples, 2 * STRIDE, 0);
    expect(back.steps).toBeGreaterThanOrEqual(12);
    expect(back.oneWay).toBe(true);
    expect(back.biggest).toBeLessThan(0.15);
    expectEvenPace(back);
  });
});

// A longer ease than 300ms leaves room to interrupt it under a loaded test machine.
test.describe("an eased move to the last slide", () => {
  test.beforeEach(async ({ page }) => {
    await eased(page, 1000);
  });

  async function startMove(page: Page): Promise<void> {
    await page.evaluate(() => window.sliders.s!.goTo(4));
    await page.waitForFunction(
      () => document.querySelector("#s .aero-slider__track")!.scrollLeft > 300
    );
  }

  test("stops where it is on a wheel, then snaps to a slide", async ({ page, browserName }) => {
    test.fixme(
      browserName === "webkit",
      "WebKit leaves the track between slides 0 and 1 (446, 472 or 491px, scroll-snap-type x mandatory), still there 3s later"
    );
    const box = (await page.locator("#s .aero-slider__track").boundingBox())!;
    await page.mouse.move(box.x + 300, box.y + 60);
    await startMove(page);
    await page.mouse.wheel(1, 0);
    await expect
      .poll(async () => (await state(page, "s")).position % STRIDE, { timeout: 5000 })
      .toBe(0);
    expect((await state(page, "s")).position).toBeLessThan(2340);
    expect(await snapStyle(page)).toBe("");
  });

  test("stops where it is on a mouse press", async ({ page }) => {
    const box = (await page.locator("#s .aero-slider__track").boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 10);
    await startMove(page);
    await page.mouse.down();
    await page.mouse.up();
    await settled(page, "s");
    expect((await state(page, "s")).position).toBeLessThan(2340);
  });

  test.describe("on a touch screen", () => {
    test.use({ hasTouch: true });

    test("stops where it is on a tap", async ({ page }) => {
      const box = (await page.locator("#s .aero-slider__track").boundingBox())!;
      await startMove(page);
      await page.touchscreen.tap(box.x + 200, box.y + 20);
      await settled(page, "s");
      expect((await state(page, "s")).position).toBeLessThan(2340);
    });
  });

  // Fails on every engine: restoring snapping between the two moves lets the browser snap the
  // track to the nearest slide (offsets 21 to 287 become 0 or 610), so the second move starts
  // from there, a visible jump back or forward.
  test.fixme("a goTo() during the move carries on from where the track is", async ({ page }) => {
    await page.evaluate(() => window.sliders.s!.goTo(4));
    await page.waitForFunction(() => {
      const offset = document.querySelector("#s .aero-slider__track")!.scrollLeft % 610;
      return offset > 20 && offset < 590;
    });
    const { before, after } = await page.evaluate(() => {
      const track = document.querySelector("#s .aero-slider__track")!;
      const before = track.scrollLeft;
      window.sliders.s!.goTo(3);
      return { before, after: track.scrollLeft };
    });
    expectNear(after, before);
  });
});
