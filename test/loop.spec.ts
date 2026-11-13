import {
  type Page,
  create,
  expect,
  expectNear,
  failOnPageErrors,
  mount,
  recordEvents,
  recordScroll,
  settled,
  slider,
  state,
  test,
} from "./fixtures";

failOnPageErrors();

/** Where the track rests with child `k` of its track (clones included) centred. */
const restOf = (page: Page, k: number) =>
  page.evaluate((k) => {
    const track = document.querySelector<HTMLElement>("#s .aero-slider__track")!;
    const r = track.querySelector(".aero-slider__slides")!.children[k]!.getBoundingClientRect();
    const tr = track.getBoundingClientRect();
    return track.scrollLeft + (r.left + r.right) / 2 - tr.left - track.clientWidth / 2;
  }, k);

/** The label of the slide whose box starts at the track's left edge. */
const slideAtLeftEdge = (page: Page) =>
  page.evaluate(() => {
    const track = document.querySelector<HTMLElement>("#s .aero-slider__track")!;
    const child = [...track.querySelector(".aero-slider__slides")!.children].find(
      (c) => Math.abs((c as HTMLElement).offsetLeft - track.scrollLeft) <= 2
    );
    return child?.textContent;
  });

const backwardSteps = (path: number[], lap: number) =>
  path
    .slice(1)
    .map((p, k) => p - path[k]!)
    .filter((d) => d < -1 && Math.abs(d + lap) > 2);

test("a loop wraps from the last slide to the first", async ({ page }) => {
  await mount(page, slider("s", 4));
  await create(page, "s", { loop: true });
  const start = await state(page, "s");
  expect(start.index).toBe(0);

  await page.evaluate(() => window.sliders.s!.goTo(3));
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 3, position: start.position + 1800 });

  await page.evaluate(() => window.sliders.s!.next());
  await settled(page, "s");
  expect(await state(page, "s")).toEqual(start);
});

test.describe("with one and a half slides in view", () => {
  // Four slides with four clones each side: the real slides are children 4 to 7.
  const BEFORE = 4;

  test.beforeEach(async ({ page }) => {
    await mount(page, slider("s", 4, { style: "--aero-slides-per-view:1.5;--aero-slide-gap:8px" }));
    await create(page, "s", { loop: true });
  });

  test("clones a full set of slides on each side, hidden from assistive tech", async ({ page }) => {
    const children = page.locator("#s .aero-slider__slides > *");
    await expect(children).toHaveCount(12);
    await expect(page.locator("#s [data-aero-slider-clone]")).toHaveCount(8);
    await expect(children.first()).toHaveAttribute("aria-hidden", "true");
  });

  test("starts centred on the first real slide", async ({ page }) => {
    const { index, position } = await state(page, "s");
    expect(index).toBe(0);
    expectNear(position, await restOf(page, BEFORE));
  });

  test("prev() from the first slide wraps to the last, and next() wraps back", async ({ page }) => {
    await page.evaluate(() => window.sliders.s!.prev());
    await settled(page, "s");
    let now = await state(page, "s");
    expect(now.index).toBe(3);
    expectNear(now.position, await restOf(page, BEFORE + 3));

    await page.evaluate(() => window.sliders.s!.next());
    await settled(page, "s");
    now = await state(page, "s");
    expect(now.index).toBe(0);
    expectNear(now.position, await restOf(page, BEFORE));
  });

  test("coming to rest on a clone teleports to its real slide", async ({ page }) => {
    const clone = await restOf(page, BEFORE + 4 + 2);
    await page.evaluate(
      (left) => (document.querySelector("#s .aero-slider__track")!.scrollLeft = left),
      clone
    );
    await settled(page, "s");
    const now = await state(page, "s");
    expect(now.index).toBe(2);
    expectNear(now.position, await restOf(page, BEFORE + 2));
  });

  test("next() from a clone steps on from that slide", async ({ page }) => {
    const changes = await recordEvents(page, "s", ["slideChange"]);
    const clone = await restOf(page, BEFORE + 4 + 1);
    await page.evaluate(
      (left) => (document.querySelector("#s .aero-slider__track")!.scrollLeft = left),
      clone
    );
    await expect.poll(() => state(page, "s").then((s) => s.index)).toBe(1);
    await page.evaluate(() => window.sliders.s!.next());
    await settled(page, "s");
    const now = await state(page, "s");
    expect(now.index).toBe(2);
    expectNear(now.position, await restOf(page, BEFORE + 2));
    expect(await changes()).toEqual(["slideChange1", "slideChange2"]);
  });

  // Scroll-driven animations read the offset before rAF runs, so a lap shift made in rAF would
  // paint them a lap away for a frame.
  test("a drag onto a clone shifts a lap within the pointermove itself", async ({ page }) => {
    const home = (await state(page, "s")).position;
    const stride = (await restOf(page, BEFORE + 1)) - (await restOf(page, BEFORE));
    const lap = (await restOf(page, BEFORE + 4)) - (await restOf(page, BEFORE));
    const track = page.locator("#s .aero-slider__track");
    await track.evaluate((track: HTMLElement) =>
      addEventListener("pointermove", () => (track.dataset.atMove = String(track.scrollLeft)))
    );
    const box = (await track.boundingBox())!;
    const x0 = box.x + 300;
    const y = box.y + 50;
    await page.mouse.move(x0, y);
    await page.mouse.down();
    await page.mouse.move(x0 + 20, y);
    await page.mouse.move(x0 + stride, y);
    const atMove = Number(await track.getAttribute("data-at-move"));
    await page.mouse.up();
    expectNear(atMove, home - stride + lap);
  });
});

test.describe("with two slides", () => {
  test.beforeEach(async ({ page }) => {
    await mount(page, slider("s", 2));
    await create(page, "s", { loop: true, scrollDuration: 1200 });
  });

  // Stepping from the live offset found the slide being left, which is the new target, so the
  // track stood still or turned back while the index and dots advanced.
  test("a second next() before the first move is halfway still moves forward", async ({ page }) => {
    const lap = 1200;
    const start = (await state(page, "s")).position;
    await page.evaluate(() => window.sliders.s!.next());
    await expect.poll(() => state(page, "s").then((s) => s.position)).toBeGreaterThan(start);
    await page.evaluate(() => window.sliders.s!.next());
    const samples = await (await recordScroll(page, "s", 1500))();
    await settled(page, "s");

    expect(backwardSteps(samples, lap)).toEqual([]);
    expect(Math.max(...samples) - samples[0]!).toBeGreaterThanOrEqual(lap * 0.75);
    expect((await state(page, "s")).index).toBe(0);
    expect(await slideAtLeftEdge(page)).toBe("0");
  });

  test("prev() goes back, though both ways round are one slide", async ({ page }) => {
    const path = await recordScroll(page, "s", 1400);
    await page.evaluate(() => window.sliders.s!.prev());
    const samples = await path();
    expect(Math.min(...samples)).toBeLessThanOrEqual(samples[0]! - 1200 / 4);
  });

  // Five steps before the track moves run a lap past the clones. Any hop the track makes meanwhile
  // must be whole laps (identical copies); a hop clamped at the runway's edge is not.
  test("a burst of next() calls stays on the runway and lands on the right slide", async ({
    page,
  }) => {
    const lap = 1200;
    const offsets = await page.evaluate(() => {
      const track = document.querySelector("#s .aero-slider__track")!;
      const out = [track.scrollLeft];
      for (let k = 0; k < 5; k++) {
        window.sliders.s!.next();
        out.push(track.scrollLeft);
      }
      return out;
    });
    const hops = offsets
      .slice(1)
      .map((p, i) => p - offsets[i]!)
      .filter((d) => Math.abs(d) > 1 && Math.abs(d / lap - Math.round(d / lap)) > 0.01);
    expect(hops).toEqual([]);

    const samples = await (await recordScroll(page, "s", 1500))();
    expect(backwardSteps(samples, lap)).toEqual([]);
    await settled(page, "s");
    expect((await state(page, "s")).index).toBe(1);
    expect(await slideAtLeftEdge(page)).toBe("1");
  });
});

// With several slides in view the last clones sit past the scrollable range, so a queued step
// that lands on one can't be reached.
// Seven steps end three slides from the start, so calls that did nothing can't pass.
test("seven quick next() calls with three slides in view land on the last slide", async ({
  page,
}) => {
  await mount(page, slider("s", 4, { style: "--aero-slides-per-view:3" }));
  await create(page, "s", { loop: true, scrollDuration: 1200 });
  await page.evaluate(() => {
    for (let k = 0; k < 7; k++) window.sliders.s!.next();
  });
  await settled(page, "s");
  expect((await state(page, "s")).index).toBe(3);
  const centred = await page.evaluate(() => {
    const track = document.querySelector<HTMLElement>("#s .aero-slider__track")!;
    const width = track.clientWidth / 3;
    const mid = track.scrollLeft + track.clientWidth / 2;
    return [...track.querySelector(".aero-slider__slides")!.children].find(
      (c) => Math.abs((c as HTMLElement).offsetLeft + width / 2 - mid) <= 2
    )?.textContent;
  });
  expect(centred).toBe("3");
});

test("clones of link slides leave the tab order and drop their ids", async ({ page }) => {
  const links = Array.from({ length: 3 }, (_, i) => `<a href="#card${i}" id="card${i}">${i}</a>`);
  await mount(
    page,
    `<div id="s" class="aero-slider" style="width:600px"><div class="aero-slider__viewport"><div class="aero-slider__track"><div class="aero-slider__slides">${links.join("")}</div></div></div></div>`
  );
  await create(page, "s", { loop: true });
  const clones = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("#s [data-aero-slider-clone]")].map((c) => ({
      tabIndex: c.tabIndex,
      id: c.id,
      hidden: c.getAttribute("aria-hidden"),
    }))
  );
  expect(clones).toEqual(Array(6).fill({ tabIndex: -1, id: "", hidden: "true" }));
});
