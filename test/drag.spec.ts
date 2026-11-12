import {
  type Page,
  create,
  expect,
  failOnPageErrors,
  mount,
  nextFrame,
  recordEvents,
  settled,
  slider,
  state,
  test,
} from "./fixtures";

failOnPageErrors();

const STRIDE = 610;

async function fiveSlides(page: Page): Promise<void> {
  await mount(page, slider("s", 5, { style: "--slide-gap:10px" }));
  await create(page, "s");
}

const trackBox = async (page: Page, id = "s") =>
  (await page.locator(`#${id} .aero-slider__track`).boundingBox())!;

const dragging = (page: Page, id = "s") =>
  page.locator(`#${id}`).evaluate((el) => el.classList.contains("aero-slider--dragging"));

const snapStyle = (page: Page, id = "s") =>
  page.locator(`#${id} .aero-slider__track`).evaluate((t: HTMLElement) => t.style.scrollSnapType);

/**
 * Moves the pressed mouse through each x in turn, a frame apart as a hand would. It returns right
 * after the last move, so a release that follows keeps the gesture's speed.
 */
async function moveThrough(page: Page, xs: number[], y: number): Promise<void> {
  for (const x of xs) {
    await nextFrame(page);
    await page.mouse.move(x, y);
  }
}

/** Moves back over the track with no button held, which must not drag it. */
async function hoverBack(page: Page, right: number, y: number): Promise<void> {
  await page.mouse.move(right - 100, y);
  await page.mouse.move(right - 300, y);
  await nextFrame(page);
}

test("the grab cursor shows only on draggable sliders", async ({ page }) => {
  await mount(page, slider("a", 3) + slider("b", 3));
  await create(page, "a");
  await create(page, "b", { draggable: false });
  await expect(page.locator("#a .aero-slider__track")).toHaveCSS("cursor", "grab");
  await expect(page.locator("#b .aero-slider__track")).not.toHaveCSS("cursor", "grab");
});

test("a mouse drag waits for the threshold, follows the pointer, and a flick moves one slide", async ({
  page,
}) => {
  await fiveSlides(page);
  const log = await recordEvents(page, "s", ["dragStart", "dragEnd", "slideChange"]);
  const box = await trackBox(page);
  const x0 = box.x + 300;
  const y = box.y + 100;

  await page.mouse.move(x0, y);
  await page.mouse.down();
  await moveThrough(page, [x0 - 3], y);
  expect(await dragging(page)).toBe(false);

  await moveThrough(
    page,
    [1, 2, 3, 4, 5, 6].map((i) => x0 - i * 20),
    y
  );
  expect(await dragging(page)).toBe(true);
  expect((await state(page, "s")).position).toBe(120);
  expect(await snapStyle(page)).toBe("none");

  // The checks above stall the gesture, which slows its measured speed; quick moves restore it.
  await moveThrough(page, [x0 - 160, x0 - 200, x0 - 240], y);
  await page.mouse.up();
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 1, position: STRIDE });
  expect(await snapStyle(page)).toBe("");
  expect(await log()).toEqual(["dragStart0", "slideChange1", "dragEnd1"]);
});

test("a press whose first move lands off the track still drags, and ends when released off it", async ({
  page,
}) => {
  await fiveSlides(page);
  const box = await trackBox(page);
  const right = box.x + box.width;
  const y = box.y + 50;

  await page.mouse.move(right - 20, y);
  await page.mouse.down();
  await page.mouse.move(right + 60, y);
  expect(await dragging(page)).toBe(true);

  await page.mouse.up();
  await hoverBack(page, right, y);
  await settled(page, "s");
  expect(await dragging(page)).toBe(false);
  expect((await state(page, "s")).position).toBe(0);
  expect(await snapStyle(page)).toBe("");
});

test("a drag ends even when an ancestor stops the pointerup", async ({ page }) => {
  await fiveSlides(page);
  await page
    .locator("#s")
    .evaluate((el) => el.addEventListener("pointerup", (e) => e.stopPropagation()));
  const box = await trackBox(page);
  const right = box.x + box.width;
  const y = box.y + 50;

  await page.mouse.move(right - 100, y);
  await page.mouse.down();
  await moveThrough(page, [right - 160, right - 220, right - 280], y);
  expect(await dragging(page)).toBe(true);

  await page.mouse.up();
  await expect.poll(() => snapStyle(page)).toBe("");
  await settled(page, "s");
  expect(await dragging(page)).toBe(false);
  expect([0, 1, 2, 3, 4].map((i) => i * STRIDE)).toContain((await state(page, "s")).position);
});

// No capture ever happens below the threshold, so only a listener off the track hears the release.
test("a press released off the track before the threshold doesn't drag on hover", async ({
  page,
}) => {
  await fiveSlides(page);
  const box = await trackBox(page);
  const right = box.x + box.width;
  const y = box.y + 50;

  await page.mouse.move(right - 2, y);
  await page.mouse.down();
  await page.mouse.move(right + 2, y);
  await page.mouse.up();
  await hoverBack(page, right, y);
  await settled(page, "s");
  expect(await dragging(page)).toBe(false);
  expect((await state(page, "s")).position).toBe(0);
  expect(await snapStyle(page)).toBe("");
});

// A browser captures pen and touch to the pressed element implicitly; only another slider's track
// holding the pointer should end the gesture.
test("content that captures the pointer on press still lets the slider drag", async ({ page }) => {
  await fiveSlides(page);
  const content = page.locator("#s .aero-slider__track > :first-child > div");
  await content.evaluate((el: HTMLElement) =>
    el.addEventListener("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      el.dataset.captured = String(el.hasPointerCapture(e.pointerId));
    })
  );
  const box = (await content.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await expect(content).toHaveAttribute("data-captured", "true");
  await moveThrough(page, [x - 20, x - 60, x - 100], y);
  expect(await dragging(page)).toBe(true);
  expect((await state(page, "s")).position).toBeGreaterThan(50);
  await page.mouse.up();
});

// The release lands in the iframe, so this window never hears it; a move with no button held
// means the press is over.
test("a press released over an iframe beside the track doesn't drag on hover", async ({ page }) => {
  await mount(
    page,
    `<div style="display:flex">${slider("s", 3)}<iframe srcdoc="<body style='margin:0;height:200px'></body>" style="width:200px;height:200px;border:0;flex:none"></iframe></div>`
  );
  await create(page, "s");
  const box = await trackBox(page);
  const right = box.x + box.width;
  const y = box.y + 50;

  await page.mouse.move(right - 2, y);
  await page.mouse.down();
  await page.mouse.move(right + 2, y);
  await page.mouse.up();
  await hoverBack(page, right, y);
  await settled(page, "s");
  expect(await dragging(page)).toBe(false);
  expect((await state(page, "s")).position).toBe(0);
  expect(await snapStyle(page)).toBe("");
});
