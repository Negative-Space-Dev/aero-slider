import {
  type Page,
  create,
  expect,
  failOnPageErrors,
  mount,
  recordEvents,
  settled,
  slider,
  state,
  test,
} from "./fixtures";

failOnPageErrors();

const INTERVAL = 300;

async function autoplaying(page: Page, interval = INTERVAL): Promise<void> {
  await mount(page, slider("s", 4));
  await create(page, "s", { loop: true, autoplay: true, autoplayInterval: interval });
}

/**
 * Dispatches a pointerdown on `#s`'s track and returns a function that lifts it on window. A real
 * mouse press would also hover the slider, and hovering pauses interval autoplay on its own.
 */
async function press(page: Page, pointerId: number, pointerType = "mouse") {
  await page.evaluate(
    ([pointerId, pointerType]) => {
      const track = document.querySelector("#s .aero-slider__track")!;
      const r = track.getBoundingClientRect();
      track.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId,
          pointerType,
          button: 0,
          buttons: 1,
          clientX: r.left + 10,
          clientY: r.top + 10,
        })
      );
    },
    [pointerId, pointerType] as const
  );
  return () =>
    page.evaluate(
      ([pointerId, pointerType]) =>
        dispatchEvent(new PointerEvent("pointerup", { pointerId, pointerType })),
      [pointerId, pointerType] as const
    );
}

/** Waits long enough for autoplay to have moved several times if nothing holds it. */
const severalIntervals = (page: Page) => page.waitForTimeout(3 * INTERVAL);

test("interval autoplay advances one slide per interval and wraps", async ({ page }) => {
  await autoplaying(page);
  const changes = await recordEvents(page, "s", ["slideChange"]);
  await expect.poll(async () => (await changes()).length, { timeout: 10_000 }).toBeGreaterThan(3);
  expect((await changes()).slice(0, 4)).toEqual([
    "slideChange1",
    "slideChange2",
    "slideChange3",
    "slideChange0",
  ]);
});

test("a manual change earns a full interval before the next automatic one", async ({ page }) => {
  await autoplaying(page, 400);
  const gap = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const el = document.getElementById("s")!;
        let manualAt = 0;
        el.addEventListener("aero:slideChange", (e) => {
          const index = (e as CustomEvent).detail.index;
          if (!manualAt && index === 1) {
            setTimeout(() => {
              manualAt = performance.now();
              window.sliders.s!.goTo(3);
            }, 150);
          } else if (manualAt && index === 0) resolve(performance.now() - manualAt);
        });
      })
  );
  expect(gap).toBeGreaterThanOrEqual(300);
});

test("pause() holds interval autoplay until resume()", async ({ page }) => {
  await autoplaying(page);
  await page.evaluate(() => window.sliders.s!.pause());
  const at = (await state(page, "s")).index;
  const changes = await recordEvents(page, "s", ["slideChange"]);
  await severalIntervals(page);
  expect(await changes()).toEqual([]);

  await page.evaluate(() => window.sliders.s!.resume());
  await expect.poll(async () => (await changes())[0]).toBe(`slideChange${(at + 1) % 4}`);
});

test("a press holds interval autoplay until it lifts", async ({ page }) => {
  await autoplaying(page);
  const changes = await recordEvents(page, "s", ["slideChange"]);
  const lift = await press(page, 2);
  await severalIntervals(page);
  expect(await changes()).toEqual([]);

  await lift();
  await expect.poll(async () => (await changes()).length).toBeGreaterThan(0);
});

test("a press that sets off a scroll restarts autoplay once that scroll settles", async ({
  page,
}) => {
  await autoplaying(page);
  const times = await page.evaluate(
    () =>
      new Promise<{ settled: number; started: number }>((resolve) => {
        const el = document.getElementById("s")!;
        const track = el.querySelector(".aero-slider__track")!;
        let settled = 0;
        // Capture runs before the slider's own scrollend handler, which is what restarts autoplay.
        track.addEventListener("scrollend", () => (settled ||= performance.now()), {
          capture: true,
        });
        el.addEventListener("aero:autoplayStart", () =>
          resolve({ settled, started: performance.now() })
        );
        const r = track.getBoundingClientRect();
        const init = {
          pointerId: 2,
          pointerType: "mouse",
          clientX: r.left + 10,
          clientY: r.top + 10,
        };
        track.dispatchEvent(
          new PointerEvent("pointerdown", { ...init, bubbles: true, buttons: 1 })
        );
        dispatchEvent(new PointerEvent("pointerup", init));
        track.scrollBy({ left: 300, behavior: "smooth" });
      })
  );
  expect(times.settled).toBeGreaterThan(0);
  expect(times.started).toBeGreaterThanOrEqual(times.settled);
});

// The interval is shorter than the ease, so each tick lands while a move is in flight. Every move
// autoplay starts must start from rest on a slide, never part way through the previous one.
test("interval autoplay waits for an eased move to land before starting the next", async ({
  page,
}) => {
  await mount(page, slider("s", 4));
  await create(page, "s", {
    loop: true,
    autoplay: true,
    autoplayInterval: 300,
    scrollDuration: 900,
  });
  const offsets = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const el = document.getElementById("s")!;
        const track = el.querySelector(".aero-slider__track")!;
        const offsets: number[] = [];
        el.addEventListener("aero:slideChange", () => {
          offsets.push(track.scrollLeft);
          if (offsets.length === 3) resolve(offsets);
        });
      })
  );
  // Slides are 600px wide with no gap, so a slide at rest sits on a multiple of 600.
  expect(offsets.map((o) => Math.round(o / 600) * 600 - Math.round(o))).toEqual([0, 0, 0]);
});

test.describe("held by several pointers", () => {
  test("holds until the last pointer lifts", async ({ page }) => {
    await autoplaying(page);
    await page.evaluate(() => window.sliders.s!.pause());
    await settled(page, "s");
    const first = await press(page, 41, "touch");
    const second = await press(page, 42, "touch");
    await page.evaluate(() => window.sliders.s!.resume());
    const changes = await recordEvents(page, "s", ["slideChange"]);

    await first();
    await severalIntervals(page);
    expect(await changes()).toEqual([]);

    await second();
    await expect.poll(async () => (await changes()).length).toBeGreaterThan(0);
  });
});

test("content that stops pointerup from bubbling can't strand the press hold", async ({ page }) => {
  await mount(
    page,
    slider("s", 3, { inner: (i) => (i === 0 ? `<button id="stop">0</button>` : `<div>${i}</div>`) })
  );
  await create(page, "s", { loop: true, autoplay: true, autoplayInterval: 150 });
  const changes = await recordEvents(page, "s", ["slideChange"]);
  await page.evaluate(() => {
    const button = document.getElementById("stop")!;
    button.addEventListener("pointerup", (e) => e.stopPropagation());
    for (const type of ["pointerdown", "pointerup"]) {
      button.dispatchEvent(
        new PointerEvent(type, { bubbles: true, pointerId: 43, pointerType: "touch" })
      );
    }
  });
  await expect.poll(async () => (await changes()).length).toBeGreaterThan(0);
});
