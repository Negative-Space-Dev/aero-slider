import {
  type Page,
  create,
  expect,
  expectNear,
  failOnPageErrors,
  mount,
  nextFrame,
  recordEvents,
  settled,
  slider,
  test,
} from "./fixtures";

failOnPageErrors();

const SPEED = 600;

/** Measures a ticker from inside the page. Every function takes the slider's element id. */
interface Ticker {
  track(id: string): HTMLElement;
  animations(id: string): Animation[];
  /** Distance between neighbouring slides. */
  stride(id: string): number;
  /**
   * How far the content has travelled: which real slide sits under the track's centre and how far
   * into it, so a steady drift grows it by speed × time and any jump shows up in one frame.
   */
  content(id: string): number;
  /** The label of the slide nearest the track's centre. */
  visible(id: string): number;
  /** Seeks every slide's animation to `time` into the lap with one shared startTime, as a lap starts. */
  seek(id: string, time: number): void;
  /** The lap's duration in ms. */
  lapDuration(id: string): number;
  /** content() with its frame time on every frame for `ms`. */
  record(id: string, ms: number): Promise<{ time: number; content: number }[]>;
  /** Stops scrollend reaching the slider, as during a wheel or trackpad gesture; returns the undo. */
  blockScrollend(id: string): () => void;
}

declare global {
  interface Window {
    ticker: Ticker;
  }
}

function installTicker(): void {
  const track = (id: string) =>
    document.querySelector<HTMLElement>(`#${id} > .aero-slider__viewport > .aero-slider__track`)!;
  const stride = (id: string) => {
    const [a, b] = track(id).children;
    return b!.getBoundingClientRect().left - a!.getBoundingClientRect().left;
  };
  const animations = (id: string) => track(id).getAnimations({ subtree: true });
  const content = (id: string) => {
    const r = track(id).getBoundingClientRect();
    const centre = r.left + r.width / 2;
    let best: { left: number; label: number } | null = null;
    for (const k of track(id).children) {
      const b = k.getBoundingClientRect();
      if (b.left <= centre && (!best || b.left > best.left)) {
        best = { left: b.left, label: Number(k.textContent) };
      }
    }
    return best!.label * stride(id) + (centre - best!.left);
  };
  window.ticker = {
    track,
    animations,
    stride,
    content,
    visible(id) {
      const r = track(id).getBoundingClientRect();
      const mid = r.left + r.width / 2;
      let best = { label: -1, d: Infinity };
      for (const k of track(id).children) {
        const b = k.getBoundingClientRect();
        const d = Math.abs(b.left + b.width / 2 - mid);
        if (d < best.d) best = { label: Number(k.textContent), d };
      }
      return best.label;
    },
    seek(id, time) {
      const start = Number(document.timeline.currentTime) - time;
      for (const a of animations(id)) a.startTime = start;
    },
    lapDuration: (id) => Number(animations(id)[0]!.effect!.getTiming().duration),
    async record(id, ms) {
      const out: { time: number; content: number }[] = [];
      const end = performance.now() + ms;
      while (performance.now() < end) {
        const time = await new Promise<number>(requestAnimationFrame);
        out.push({ time, content: content(id) });
      }
      return out;
    },
    blockScrollend(id) {
      const el = document.getElementById(id)!;
      const block = (e: Event) => e.stopPropagation();
      el.addEventListener("scrollend", block, { capture: true });
      return () => el.removeEventListener("scrollend", block, { capture: true });
    },
  };
}

const animationCount = (page: Page, id = "s") =>
  page.evaluate((id) => window.ticker.animations(id).length, id);

/** Signed shortest distance from `a` to `b` round a lap of `cycle`. */
const shift = (a: number, b: number, cycle: number) =>
  ((((b - a + cycle / 2) % cycle) + cycle) % cycle) - cycle / 2;

/**
 * Checks a recorded drift: every frame should move the content forward by speed × frame time, so
 * a lap seam or a hand-back shows up as a bad frame.
 */
function steady(samples: { time: number; content: number }[], cycle: number, speed = SPEED) {
  const frames = samples.slice(1).map(({ time, content }, k) => ({
    dt: time - samples[k]!.time,
    d: (((content - samples[k]!.content) % cycle) + cycle) % cycle,
  }));
  const bad = frames.filter(
    ({ dt, d }) => Math.abs(d - (speed * dt) / 1000) > Math.max(3, (0.3 * speed * dt) / 1000)
  );
  const total = frames.reduce((a, f) => a + f.d, 0);
  const time = frames.reduce((a, f) => a + f.dt, 0);
  return { frames: frames.length, bad: bad.slice(0, 3), speed: Math.round((total / time) * 1000) };
}

const tickerMarkup = (id: string, n: number, inner?: (i: number) => string) =>
  slider(id, n, { style: "--slides-per-view:3;--slide-gap:10px", inner });

async function ticker(page: Page, config: Parameters<typeof create>[2] = {}): Promise<number> {
  await page.addInitScript(installTicker);
  await mount(
    page,
    tickerMarkup("s", 4, (i) => (i === 0 ? `<button id="tick">0</button>` : `<div>${i}</div>`))
  );
  await create(page, "s", { autoplay: "continuous", autoplaySpeed: SPEED, ...config });
  return page.evaluate(() => 4 * window.ticker.stride("s"));
}

test("continuous autoplay runs one shared animation on every slide, clones included", async ({
  page,
}) => {
  await ticker(page);
  await expect(page.locator("#s")).toHaveClass(/aero-slider--free/);
  const setup = await page.evaluate(() => {
    const animations = window.ticker.animations("s");
    return {
      children: window.ticker.track("s").children.length,
      animations: animations.length,
      startTimes: new Set(animations.map((a) => a.startTime)).size,
    };
  });
  expect(setup).toEqual({ children: 4 + 2 * (4 + 3 + 2), animations: 22, startTimes: 1 });
});

test("the drift moves steadily at autoplaySpeed, across the lap's seam", async ({ page }) => {
  const cycle = await ticker(page);
  const run = steady(await page.evaluate(() => window.ticker.record("s", 2000)), cycle);
  expect(run.frames).toBeGreaterThan(60);
  expect(run.bad).toEqual([]);
  expect(Math.abs(run.speed - SPEED)).toBeLessThan(SPEED * 0.1);
});

test("the content steps evenly across the lap's seam", async ({ page }) => {
  const cycle = await ticker(page);
  const { before, after } = await page.evaluate(() => {
    const duration = window.ticker.lapDuration("s");
    window.ticker.seek("s", duration - 5);
    const before = window.ticker.content("s");
    window.ticker.seek("s", duration + 5);
    return { before, after: window.ticker.content("s") };
  });
  expectNear((((after - before) % cycle) + cycle) % cycle, (SPEED * 10) / 1000);
});

test("rtl drifts the other way on screen", async ({ page }) => {
  await page.addInitScript(installTicker);
  await mount(page, tickerMarkup("s", 4));
  await create(page, "s", { autoplay: "continuous", autoplaySpeed: SPEED, direction: "rtl" });
  const pxPerMs = await page.evaluate(async () => {
    const slide = window.ticker.track("s").children[5]!;
    const cycle = 4 * Math.abs(window.ticker.stride("s"));
    const t0 = await new Promise<number>(requestAnimationFrame);
    const x0 = slide.getBoundingClientRect().left;
    await new Promise((r) => setTimeout(r, 200));
    const t1 = await new Promise<number>(requestAnimationFrame);
    // Modulo a lap: a slide's box jumps back a lap at the seam, invisibly.
    const moved = (((slide.getBoundingClientRect().left - x0) % cycle) + cycle) % cycle;
    return moved / (t1 - t0);
  });
  expect(pxPerMs).toBeGreaterThan(0.3);
  expect(pxPerMs).toBeLessThan(1);
});

test("a mouse press holds the drift without a jump, and release resumes it", async ({ page }) => {
  const cycle = await ticker(page);
  const box = (await page.locator("#s .aero-slider__track").first().boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  const recording = page.evaluate(() => window.ticker.record("s", 700));
  await page.waitForTimeout(150);
  await page.mouse.down();
  const samples = await recording;
  expect(await animationCount(page)).toBe(0);

  const steps = samples.slice(1).map((s, k) => ({
    d: shift(samples[k]!.content, s.content, cycle),
    drift: (SPEED * (s.time - samples[k]!.time)) / 1000,
  }));
  expect(steps.filter(({ d, drift }) => d < -1.5 || d > drift * 1.3 + 3)).toEqual([]);
  expect(steps.slice(-10).map(({ d }) => Math.abs(d) < 0.5)).toEqual(Array(10).fill(true));

  await page.mouse.up();
  await expect.poll(() => animationCount(page)).toBeGreaterThan(0);
  const run = steady(await page.evaluate(() => window.ticker.record("s", 300)), cycle);
  expect(run.bad).toEqual([]);
});

test("pause() holds the drift where it is and resume() restarts it", async ({ page }) => {
  await ticker(page);
  const pausedAt = await page.evaluate(() => {
    window.sliders.s!.pause();
    return window.ticker.content("s");
  });
  await page.waitForTimeout(300);
  expect(await animationCount(page)).toBe(0);
  expectNear(await page.evaluate(() => window.ticker.content("s")), pausedAt, 0.5);

  await page.evaluate(() => window.sliders.s!.resume());
  await expect.poll(() => animationCount(page)).toBeGreaterThan(0);
});

// A wheel or trackpad stream sends no scrollend until it ends, so the loop's teleport hasn't run.
test("a big scroll late in a lap is folded back, so no empty track shows", async ({ page }) => {
  await ticker(page);
  const covered = await page.evaluate(async () => {
    const t = window.ticker.track("s");
    const unblock = window.ticker.blockScrollend("s");
    window.ticker.seek("s", window.ticker.lapDuration("s") * 0.95);
    t.scrollLeft = t.scrollWidth;
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const end = t.lastElementChild!.getBoundingClientRect().right;
    const edge = t.getBoundingClientRect().right;
    unblock();
    return { end, edge, animations: window.ticker.animations("s").length };
  });
  expect(covered.end).toBeGreaterThanOrEqual(covered.edge - 0.5);
  expect(covered.animations).toBeGreaterThan(0);
});

test("goTo() takes the lap back without a jump, then the drift resumes", async ({ page }) => {
  const cycle = await ticker(page);
  const handOff = await page.evaluate(() => {
    const before = window.ticker.content("s");
    window.sliders.s!.goTo(1);
    return {
      before,
      after: window.ticker.content("s"),
      animations: window.ticker.animations("s").length,
    };
  });
  expect(handOff.animations).toBe(0);
  expectNear(shift(handOff.before, handOff.after, cycle), 0);
  await expect.poll(() => animationCount(page), { timeout: 5000 }).toBeGreaterThan(0);
});

test("next() steps from the slide that's showing, not the index from before the drift", async ({
  page,
}) => {
  await ticker(page);
  const showing = await page.evaluate(() => {
    window.ticker.seek("s", window.ticker.lapDuration("s") / 2);
    const showing = window.ticker.visible("s");
    window.sliders.s!.next();
    return showing;
  });
  expect(showing).not.toBe(0);
  await settled(page, "s");
  expect(await page.evaluate(() => window.sliders.s!.currentIndex)).toBe((showing + 1) % 4);
});

// Jumping back a lap any sooner than running out of track cut WebKit's smooth wheel gestures short.
test("a scroll that crosses the lap's boundary mid-gesture isn't jumped back", async ({ page }) => {
  await ticker(page);
  await page.evaluate(() => {
    window.sliders.s!.pause();
    window.sliders.s!.goTo(0, { instant: true });
  });
  await settled(page, "s");
  const crossed = await page.evaluate(async () => {
    const t = window.ticker.track("s");
    const kids = t.children;
    const home = t.scrollLeft;
    const cycle = kids[4]!.getBoundingClientRect().left - kids[0]!.getBoundingClientRect().left;
    window.sliders.s!.resume();
    await new Promise(requestAnimationFrame);
    const unblock = window.ticker.blockScrollend("s");
    t.scrollLeft = home + cycle;
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    unblock();
    return {
      want: home + cycle,
      now: t.scrollLeft,
      animations: window.ticker.animations("s").length,
    };
  });
  expectNear(crossed.now, crossed.want);
  expect(crossed.animations).toBeGreaterThan(0);
});

test("a resize mid-drift keeps the slide that's showing", async ({ page }) => {
  // Slow enough that the drift can't carry a new slide to the centre while the resize lands.
  await ticker(page, { autoplaySpeed: 60 });
  const { before, after } = await page.evaluate(async () => {
    window.ticker.seek("s", window.ticker.lapDuration("s") / 2);
    const before = window.ticker.visible("s");
    document.getElementById("s")!.style.width = "601px";
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    return { before, after: window.ticker.visible("s") };
  });
  expect(before).not.toBe(0);
  expect(after).toBe(before);
});

test("a resize replaces the lap without autoplayStop or autoplayStart", async ({ page }) => {
  await ticker(page);
  const events = await recordEvents(page, "s", ["autoplayStart", "autoplayStop"]);
  for (const width of ["601px", "600px"]) {
    await page.evaluate((width) => (document.getElementById("s")!.style.width = width), width);
    await nextFrame(page);
    await nextFrame(page);
  }
  expect(await events()).toEqual([]);
  expect(await animationCount(page)).toBeGreaterThan(0);
});

test.describe("product links as slides", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installTicker);
    const links = Array.from(
      { length: 4 },
      (_, i) => `<a href="#l${i}" style="display:block;height:100px">${i}</a>`
    );
    await mount(
      page,
      `<div id="s" class="aero-slider" style="width:600px;--slides-per-view:3;--slide-gap:10px"><div class="aero-slider__viewport"><div class="aero-slider__track">${links.join("")}</div></div></div>`
    );
    await create(page, "s", { autoplay: "continuous", autoplaySpeed: 36, draggable: false });
  });

  // Dragging a link starts the browser's own drag, which swallows the pointerup.
  for (const end of ["dragend", "pointermove"] as const) {
    test(`a press ended by a native drag's ${end} resumes the drift`, async ({ page }) => {
      await page.evaluate(() => {
        const r = window.ticker.track("s").getBoundingClientRect();
        window.ticker.track("s").dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            pointerId: 1,
            pointerType: "mouse",
            button: 0,
            buttons: 1,
            clientX: r.left + 20,
            clientY: r.top + 20,
          })
        );
      });
      expect(await animationCount(page)).toBe(0);
      await page.evaluate((end) => {
        if (end === "dragend") {
          document
            .querySelector("#s a")!
            .dispatchEvent(new DragEvent("dragend", { bubbles: true }));
        } else {
          dispatchEvent(
            new PointerEvent("pointermove", { pointerId: 1, pointerType: "mouse", buttons: 0 })
          );
        }
      }, end);
      await expect.poll(() => animationCount(page)).toBeGreaterThan(0);
    });
  }

  // Handing the lap back mustn't swap the card under the pointer for its copy a lap away.
  test("a click on a link late in a lap still reaches the link", async ({ page }) => {
    await page.evaluate(() => {
      const el = document.getElementById("s")!;
      for (const a of el.querySelectorAll("a")) {
        a.addEventListener("click", (e) => {
          e.preventDefault();
          el.dataset.clicks = (el.dataset.clicks ?? "") + a.textContent;
        });
      }
      window.ticker.seek("s", window.ticker.lapDuration("s") * 0.95);
    });
    const box = (await page.locator("#s .aero-slider__track").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 50);
    await page.mouse.down();
    await nextFrame(page);
    await nextFrame(page);
    await page.mouse.up();
    await expect(page.locator("#s")).toHaveAttribute("data-clicks", /^\d$/);
  });
});

test("a short left-aligned rail, no more slides than fit, still drifts", async ({ page }) => {
  await mount(page, tickerMarkup("s", 3));
  await create(page, "s", { autoplay: "continuous", alignment: "left" });
  expect(
    await page.evaluate(
      () =>
        document.querySelector("#s .aero-slider__track")!.getAnimations({ subtree: true }).length
    )
  ).toBeGreaterThan(0);
});

test("autoplaySpeed is honoured below 1px/s", async ({ page }) => {
  await page.addInitScript(installTicker);
  await mount(page, tickerMarkup("s", 4));
  await create(page, "s", { autoplay: "continuous", autoplaySpeed: 0.5 });
  const { duration, lap } = await page.evaluate(() => {
    const kids = window.ticker.track("s").children;
    return {
      duration: window.ticker.lapDuration("s"),
      lap: kids[4]!.getBoundingClientRect().left - kids[0]!.getBoundingClientRect().left,
    };
  });
  expectNear(duration, (lap / 0.5) * 1000, 50);
});

test("autoplaySpeed 0 keeps the track still", async ({ page }) => {
  await page.addInitScript(installTicker);
  await mount(page, tickerMarkup("s", 4));
  await create(page, "s", { autoplay: "continuous", autoplaySpeed: 0 });
  expect(await animationCount(page)).toBe(0);
});

test("keyboard focus inside holds the drift, and leaving resumes it", async ({ page }) => {
  await ticker(page);
  // A real key press first, so the focus that follows counts as keyboard focus (:focus-visible).
  await page.keyboard.press("Shift");
  const button = page.locator("#tick");
  await button.focus();
  expect(await button.evaluate((b) => b.matches(":focus-visible"))).toBe(true);
  const x = (await button.boundingBox())!.x;
  await page.waitForTimeout(300);
  expect(await animationCount(page)).toBe(0);
  expectNear((await button.boundingBox())!.x, x, 0.5);

  await button.blur();
  await expect.poll(() => animationCount(page)).toBeGreaterThan(0);
});

test("a wheel scroll during the drift adds to it and the drift carries on", async ({ page }) => {
  const cycle = await ticker(page);
  const box = (await page.locator("#s .aero-slider__track").first().boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 60);
  const recording = page.evaluate(() => window.ticker.record("s", 1200));
  await page.waitForTimeout(200);
  await page.mouse.wheel(300, 0);
  const samples = await recording;
  const steps = samples.slice(1).map((s, k) => shift(samples[k]!.content, s.content, cycle));
  const moved = steps.reduce((a, d) => a + d, 0);
  const drift = (SPEED * (samples.at(-1)!.time - samples[0]!.time)) / 1000;
  expect(steps.filter((d) => d < -1)).toEqual([]);
  expect(moved).toBeGreaterThan(drift + 200);
  expect(moved).toBeLessThan(drift + 400);
  expect(await animationCount(page)).toBeGreaterThan(0);
});
