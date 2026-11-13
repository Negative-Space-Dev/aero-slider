import { type Page, create, expect, mount, slider, test } from "./fixtures";
import { recordEvents, takeEvents } from "./helpers/state";

const status = (page: Page) => page.locator("#s .aero-slider__status");

test("a hidden status line names the slide a user moves to", async ({ page }) => {
  await mount(page, slider("s", 5));
  await create(page, "s");
  await expect(status(page)).toHaveAttribute("aria-live", "polite");
  await expect(status(page)).toHaveText("");
  await page.evaluate(() => window.sliders.s!.next());
  await expect(status(page)).toHaveText("2 of 5");
  await page.locator("#s .aero-slider__dot").nth(3).click();
  await expect(status(page)).toHaveText("4 of 5");
  await page.evaluate(() => window.sliders.s!.destroy());
  await expect(status(page)).toHaveCount(0);
});

test("data-aero-status on the container words the status line", async ({ page }) => {
  await mount(
    page,
    slider("s", 3).replace('id="s"', 'id="s" data-aero-status="Bild {index} von {count}"')
  );
  await create(page, "s");
  await page.evaluate(() => window.sliders.s!.next());
  await expect(status(page)).toHaveText("Bild 2 von 3");
});

test("the status line counts the slider's own slides, not a nested slider's", async ({ page }) => {
  const inner = slider("inner", 4, { nav: false, dots: false });
  await mount(page, slider("s", 3, { inner: (i) => (i === 0 ? inner : `<div>${i}</div>`) }));
  await create(page, "inner");
  await create(page, "s");
  await page.evaluate(() => window.sliders.s!.next());
  await expect(page.locator("#s > .aero-slider__status")).toHaveText("2 of 3");
});

test("a rebuild drops status text that names the old slide count", async ({ page }) => {
  await mount(page, slider("s", 3));
  await create(page, "s");
  await page.evaluate(() => window.sliders.s!.next());
  await expect(status(page)).toHaveText("2 of 3");

  await page.evaluate(() => {
    const row = document.querySelector("#s .aero-slider__slides")!;
    row.append(row.firstElementChild!.cloneNode(true));
    window.sliders.s!.refresh();
  });
  await expect(status(page)).toHaveText("");
  await page.evaluate(() => window.sliders.s!.next());
  await expect(status(page)).toHaveText("3 of 4");
});

test("the status line stays quiet while autoplay moves the slides", async ({ page }) => {
  await mount(page, slider("s", 4));
  await recordEvents(page, "s");
  await create(page, "s", { autoplay: true, autoplayInterval: 150, loop: true });
  await expect
    .poll(async () => (await takeEvents(page, "s")).some((e) => e.startsWith("slideChange")))
    .toBe(true);
  await expect(status(page)).toHaveText("");
  const target = await page.evaluate(() => {
    const instance = window.sliders.s!;
    instance.pause();
    const index = (instance.currentIndex + 2) % 4;
    instance.goTo(index);
    return index;
  });
  await expect(status(page)).toHaveText(`${target + 1} of 4`);
});

// A control outside the slider calls goTo() without pausing anything.
test("a manual change is announced while autoplay keeps running", async ({ page }) => {
  await mount(page, slider("s", 4));
  await create(page, "s", { autoplay: true, autoplayInterval: 60_000, loop: true });
  await page.evaluate(() => window.sliders.s!.goTo(2));
  await expect(status(page)).toHaveText("3 of 4");
});

const autoplayEvents = async (page: Page) =>
  (await takeEvents(page, "s")).filter((event) => event.startsWith("autoplay"));

// The pause control is the author's own button, wired up as the docs show.
test("a page's own button pauses and resumes autoplay through pause() and resume()", async ({
  page,
}) => {
  await mount(
    page,
    slider("s", 5).replace(/<\/div>$/, `<button type="button" id="toggle">Pause</button></div>`)
  );
  await recordEvents(page, "s");
  await create(page, "s", { autoplay: true });
  await page.evaluate(() => {
    const toggle = document.getElementById("toggle")!;
    let paused = false;
    toggle.addEventListener("click", () => {
      paused = !paused;
      window.sliders.s![paused ? "pause" : "resume"]();
      toggle.setAttribute("aria-pressed", String(paused));
    });
  });
  await takeEvents(page, "s");
  // A scripted click, so neither hover nor focus pauses autoplay on its own.
  const press = () => page.locator("#toggle").evaluate((el: HTMLElement) => el.click());
  await press();
  expect(await autoplayEvents(page)).toEqual(["autoplayStop"]);
  await press();
  expect(await autoplayEvents(page)).toEqual(["autoplayStart"]);
});
