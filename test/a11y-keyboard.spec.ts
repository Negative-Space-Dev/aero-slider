import { type Page, create, expect, mount, settled, slider, test } from "./fixtures";
import { state } from "./helpers/state";

declare global {
  interface Window {
    /** Whether each keydown that reached window had its default prevented, as "key:true". */
    keys: string[];
  }
}

/** Logs, for every keydown that reaches window, whether something prevented its default. */
const recordKeys = (page: Page) =>
  page.evaluate(() => {
    window.keys = [];
    addEventListener("keydown", (e: KeyboardEvent) => {
      if (!/^(Alt|Shift|Control|Meta)$/.test(e.key))
        window.keys.push(`${e.key}:${e.defaultPrevented}`);
    });
  });
const takeKeys = (page: Page) => page.evaluate(() => window.keys.splice(0));
const index = async (page: Page, id = "s") => (await state(page, id)).index;

// Firefox scrolls the track itself on an unhandled arrow key from a link, so for the link this
// checks only that the slider left the key alone. The widget handles its keys, as a real one would.
test("arrow keys inside slide content belong to that content", async ({ page }) => {
  const content = (i: number) =>
    i === 0
      ? `<a href="#x" id="link">link</a>`
      : i === 1
        ? `<div role="slider" tabindex="0" id="widget" aria-valuenow="0" onkeydown="event.preventDefault()">widget</div>`
        : String(i);
  await mount(page, slider("s", 4, { inner: content, style: "--slides-per-view:2" }));
  await create(page, "s", { alignment: "left" });
  await recordKeys(page);
  await page.locator("#link").focus();
  await page.keyboard.press("ArrowRight");
  expect(await takeKeys(page)).toEqual(["ArrowRight:false"]);
  await settled(page, "s");

  await page.evaluate(() => window.sliders.s!.goTo(0, { instant: true }));
  await page.locator("#widget").focus();
  await page.keyboard.press("ArrowRight");
  await settled(page, "s");
  expect(await index(page)).toBe(0);
});

test("an arrow key in a nested slider moves only that slider", async ({ page }) => {
  const inner = slider("inner", 3, { nav: false, dots: false });
  await mount(page, slider("outer", 3, { inner: (i) => (i === 0 ? inner : String(i)) }));
  await create(page, "inner");
  await create(page, "outer");
  await page.locator("#inner").focus();
  await page.keyboard.press("ArrowRight");
  await settled(page, "inner");
  expect(await index(page, "inner")).toBe(1);
  expect(await index(page, "outer")).toBe(0);
});

// The slider prevents the default of every key it acts on, so "false" shows it stayed out. The
// index isn't checked: WebKit scrolls the track itself on Shift or Ctrl with an arrow.
test("arrows with a modifier, or already handled, are left alone", async ({ page }) => {
  await mount(page, slider("s", 4));
  await create(page, "s");
  await page.evaluate(() => window.sliders.s!.goTo(1, { instant: true }));
  await recordKeys(page);
  await page.locator("#s").focus();
  for (const key of ["Alt+ArrowLeft", "Shift+ArrowRight", "Control+ArrowRight", "Meta+ArrowLeft"]) {
    await page.keyboard.press(key);
  }
  await page.evaluate(() =>
    document.getElementById("s")!.firstElementChild!.addEventListener("keydown", (e) => {
      e.preventDefault();
    })
  );
  await page.locator("#s .aero-slider__track").focus();
  await page.keyboard.press("ArrowRight");
  expect(await takeKeys(page)).toEqual([
    "ArrowLeft:false",
    "ArrowRight:false",
    "ArrowRight:false",
    "ArrowLeft:false",
    "ArrowRight:true",
  ]);
});

test("the container, track, nav buttons and dots take arrows, Home and End", async ({ page }) => {
  await mount(page, slider("s", 5));
  await create(page, "s");
  const steps: [string, string, number][] = [
    ["#s", "ArrowRight", 1],
    ["#s .aero-slider__track", "ArrowRight", 2],
    ["#s .aero-slider__nav--prev", "ArrowLeft", 1],
    ["#s .aero-slider__dot >> nth=1", "End", 4],
    ["#s", "Home", 0],
  ];
  for (const [target, key, expected] of steps) {
    await page.locator(target).focus();
    await page.keyboard.press(key);
    await settled(page, "s");
    expect(await index(page), `${key} on ${target}`).toBe(expected);
  }
});

for (const direction of ["ltr", "ttb"] as const) {
  test(`${direction}: an arrow with nowhere to go keeps its default`, async ({ page }) => {
    await mount(page, slider("s", 3));
    await create(page, "s", { direction });
    const [back, forward] =
      direction === "ttb" ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
    await recordKeys(page);
    await page.locator("#s").focus();
    for (const key of [back, "Home", forward, forward, "End", forward]) {
      await page.keyboard.press(key);
      await settled(page, "s");
    }
    expect(await takeKeys(page)).toEqual([
      `${back}:false`,
      "Home:false",
      `${forward}:true`,
      `${forward}:true`,
      "End:false",
      `${forward}:false`,
    ]);
    expect(await index(page)).toBe(2);
  });
}

test("a loop takes every arrow", async ({ page }) => {
  await mount(page, slider("s", 4));
  await create(page, "s", { loop: true });
  await recordKeys(page);
  await page.locator("#s").focus();
  await page.keyboard.press("ArrowLeft");
  await settled(page, "s");
  expect(await takeKeys(page)).toEqual(["ArrowLeft:true"]);
  expect(await index(page)).toBe(3);
});
