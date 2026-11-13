import {
  type Page,
  create,
  expect,
  expectNear,
  failOnPageErrors,
  mount,
  nextFrame,
  settled,
  slider,
  state,
  test,
} from "./fixtures";

failOnPageErrors();

test.use({ hasTouch: true });
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "Playwright can only tap; holding or panning a finger needs CDP touch events, which only Chromium has"
);

/** One finger on the touch screen, driven through CDP so it can stay down and pan. */
async function finger(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: string, x?: number, y?: number) =>
    cdp.send("Input.dispatchTouchEvent", {
      type: type as "touchStart",
      touchPoints: x === undefined ? [] : [{ x, y: y! }],
    });
  return {
    down: (x: number, y: number) => touch("touchStart", x, y),
    move: (x: number, y: number) => touch("touchMove", x, y),
    up: () => touch("touchEnd"),
  };
}

const position = async (page: Page) => (await state(page, "s")).position;

/** Scrolls `#s` with a real wheel and resolves once the track has started moving. */
async function wheel(page: Page, deltaX: number): Promise<{ x: number; y: number }> {
  const box = (await page.locator("#s .aero-slider__track").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 60);
  await page.mouse.wheel(deltaX, 0);
  await page.waitForFunction(
    () => document.querySelector("#s .aero-slider__track")!.scrollLeft > 20
  );
  return { x: box.x, y: box.y };
}

async function settleSlider(page: Page, inner?: (i: number) => string): Promise<void> {
  await mount(page, slider("s", 5, { style: "--aero-slide-gap:10px", inner }));
  await create(page, "s", { snap: "settle", scrollDuration: 300 });
}

/** Stops scrollend reaching the slider, as Firefox can after a wheel scroll. */
const blockScrollend = (page: Page) =>
  page.evaluate(() =>
    document
      .getElementById("s")!
      .addEventListener("scrollend", (e) => e.stopPropagation(), { capture: true })
  );

// The wheel's settle timer must not start easing under a still finger. It settles on release.
test("snap: settle waits for a finger held on the track after a wheel scroll", async ({ page }) => {
  await settleSlider(page);
  await blockScrollend(page);
  const touch = await finger(page);
  const box = await wheel(page, 80);
  await touch.down(box.x + 300, box.y + 60);
  await nextFrame(page);
  await nextFrame(page);
  const at = await position(page);
  await page.waitForTimeout(600);
  expect(at).toBeGreaterThan(40);
  expectNear(await position(page), at);

  await touch.up();
  await expect.poll(() => state(page, "s")).toEqual({ index: 0, position: 0 });
});

test("snap: settle waits for a finger even when content stops its touchstart", async ({ page }) => {
  await settleSlider(page);
  await page.evaluate(() => {
    for (const slide of document.querySelector("#s .aero-slider__track")!.children) {
      slide.addEventListener("touchstart", (e) => e.stopPropagation());
    }
  });
  const touch = await finger(page);
  const box = await wheel(page, 80);
  await touch.down(box.x + 300, box.y + 60);
  await nextFrame(page);
  await nextFrame(page);
  const at = await position(page);
  await page.waitForTimeout(700);
  expect(at).toBeGreaterThan(20);
  expectNear(await position(page), at);
  await touch.up();
});

// The browser takes a panning finger over and sends pointercancel, but the finger is still down.
test("snap: settle waits for a finger that panned the track and stays down", async ({ page }) => {
  await mount(page, slider("s", 4, { style: "--aero-slide-gap:10px" }));
  await create(page, "s", { loop: true, snap: "settle", scrollDuration: 300 });
  await page.evaluate(() => window.sliders.s!.goTo(1, { instant: true }));
  await settled(page, "s");
  const start = await position(page);
  const touch = await finger(page);
  const box = (await page.locator("#s .aero-slider__track").boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + 60);
  await page.mouse.wheel(120, 0);
  await page.waitForFunction(
    (start) => document.querySelector("#s .aero-slider__track")!.scrollLeft > start + 20,
    start
  );

  const x = box.x + 400;
  const y = box.y + 60;
  await touch.down(x, y);
  for (let i = 1; i <= 10; i++) {
    await touch.move(x - i * 10, y);
    await nextFrame(page);
  }
  await settled(page, "s");
  const at = await position(page);
  await page.waitForTimeout(700);
  expectNear(await position(page), at);

  await touch.up();
  const offCentre = () =>
    page.evaluate(() => {
      const track = document.querySelector("#s .aero-slider__track")!;
      const r = track.getBoundingClientRect();
      const mid = r.left + r.width / 2;
      return Math.min(
        ...[...track.children].map((k) => {
          const b = k.getBoundingClientRect();
          return Math.abs(b.left + b.width / 2 - mid);
        })
      );
    });
  await expect.poll(offCentre).toBeLessThan(1.5);
});

// If remove() detaches the touched slide, its touchend no longer reaches window.
test("snap: settle still settles after a finger whose slide was removed lifts", async ({
  page,
}) => {
  await settleSlider(page);
  const touch = await finger(page);
  const box = (await page.locator("#s .aero-slider__track").boundingBox())!;
  await touch.down(box.x + 300, box.y + 60);
  await page.evaluate(() => window.sliders.s!.remove(0));
  await touch.up();
  await settled(page, "s");

  await wheel(page, 80);
  await expect.poll(() => state(page, "s")).toEqual({ index: 0, position: 0 });
});
