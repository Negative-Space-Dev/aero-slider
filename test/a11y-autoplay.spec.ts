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

test("the status line uses the slidePosition label", async ({ page }) => {
  await mount(page, slider("s", 3));
  await create(page, "s", { labels: { slidePosition: "Bild {index} von {count}" } });
  await page.evaluate(() => window.sliders.s!.next());
  await expect(status(page)).toHaveText("Bild 2 von 3");
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

const autoplayEvents = async (page: Page) =>
  (await takeEvents(page, "s")).filter((event) => event.startsWith("autoplay"));

const withToggle = (
  id: string,
  n: number,
  button = `<button class="aero-slider__autoplay"></button>`
) => slider(id, n, { style: "--slides-per-view:2" }).replace(/<\/div>$/, `${button}</div>`);

test("the autoplay button pauses until pressed again, in step with pause() and resume()", async ({
  page,
}) => {
  await mount(page, withToggle("s", 5));
  await recordEvents(page, "s");
  await create(page, "s", { autoplay: true });
  await takeEvents(page, "s");
  const root = page.locator("#s");
  const toggle = page.locator("#s .aero-slider__autoplay");
  // A scripted click, so neither hover nor focus pauses autoplay on its own.
  const press = () => toggle.evaluate((el: HTMLElement) => el.click());

  await expect(toggle).toHaveAccessibleName("Pause autoplay");
  await press();
  expect(await autoplayEvents(page)).toEqual(["autoplayStop"]);
  await expect(toggle).toHaveAccessibleName("Start autoplay");
  // The name already says what a press does; a pressed state on top would contradict it.
  await expect(toggle).not.toHaveAttribute("aria-pressed");
  await expect(root).toHaveClass(/aero-slider--paused/);

  await page.evaluate(() => window.sliders.s!.resume());
  expect(await autoplayEvents(page)).toEqual(["autoplayStart"]);
  await expect(toggle).toHaveAccessibleName("Pause autoplay");
  await expect(root).not.toHaveClass(/aero-slider--paused/);

  await page.evaluate(() => window.sliders.s!.pause());
  await expect(toggle).toHaveAccessibleName("Start autoplay");
  await press();
  expect(await autoplayEvents(page)).toEqual(["autoplayStop", "autoplayStart"]);
  await expect(toggle).toHaveAccessibleName("Pause autoplay");
});

test("a button with its own name carries the state in aria-pressed", async ({ page }) => {
  await mount(
    page,
    withToggle("s", 5, `<button class="aero-slider__autoplay" aria-pressed="false">Pause</button>`)
  );
  await create(page, "s", { autoplay: true });
  const toggle = page.locator("#s .aero-slider__autoplay");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.evaluate((el: HTMLElement) => el.click());
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveAccessibleName("Pause");
  await page.evaluate(() => window.sliders.s!.destroy());
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});

test("the keyboard can start autoplay again from the button", async ({ page }) => {
  await mount(page, withToggle("s", 5));
  await recordEvents(page, "s");
  await create(page, "s", { autoplay: true, autoplayInterval: 150, loop: true });
  await page.locator("#s .aero-slider__autoplay").focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(page.locator("#s")).toHaveClass(/aero-slider--paused/);
  await takeEvents(page, "s");
  await page.keyboard.press("Enter");
  await expect
    .poll(async () => (await takeEvents(page, "s")).some((e) => e.startsWith("slideChange")))
    .toBe(true);
});

test("an outer slider leaves a nested slider's autoplay button alone", async ({ page }) => {
  const inner = withToggle("inner", 3);
  await mount(page, slider("outer", 3, { inner: (i) => (i ? `<div>${i}</div>` : inner) }));
  await create(page, "outer");
  await create(page, "inner", { autoplay: true });
  await expect(page.locator("#inner .aero-slider__autoplay")).toBeVisible();
  await expect(page.locator("#inner .aero-slider__autoplay")).toHaveAccessibleName(
    "Pause autoplay"
  );
});

test("the autoplay button hides under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mount(page, withToggle("s", 5));
  await create(page, "s", { autoplay: true });
  await expect(page.locator("#s .aero-slider__autoplay")).toBeHidden();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("#s .aero-slider__autoplay")).toBeVisible();
});

test("a pointer that pauses the ticker leaves it paused when it moves away", async ({ page }) => {
  await mount(page, withToggle("s", 5));
  await recordEvents(page, "s");
  await create(page, "s", { autoplay: "continuous" });
  await takeEvents(page, "s");
  await page.locator("#s .aero-slider__autoplay").click();
  await page.mouse.move(0, 500);
  await page.evaluate(() => new Promise((done) => setTimeout(done, 300)));
  expect(await autoplayEvents(page)).toEqual(["autoplayStop"]);
  await expect(page.getByRole("button", { name: "Start autoplay" })).toBeVisible();
});

test("the button keeps its own name, hides without autoplay, and destroy() restores it", async ({
  page,
}) => {
  await mount(
    page,
    withToggle("s", 5, `<button class="aero-slider__autoplay">Pause</button>`) + withToggle("t", 5)
  );
  // classList rewrites the class attribute without the fixture's trailing space.
  const markup = () =>
    page.evaluate(() =>
      [...document.querySelectorAll(".aero-slider")].map((el) => el.outerHTML.replace(/ "/, '"'))
    );
  const before = await markup();
  await create(page, "s", { autoplay: true });
  await create(page, "t");
  await expect(page.locator("#s .aero-slider__autoplay")).not.toHaveAttribute("aria-label");
  await expect(page.locator("#t .aero-slider__autoplay")).toBeHidden();
  await page.evaluate(() => window.sliders.t!.update({ autoplay: true }));
  await expect(page.locator("#t .aero-slider__autoplay")).toBeVisible();
  await page.evaluate(() => {
    window.sliders.s!.pause();
    window.sliders.s!.destroy();
    window.sliders.t!.destroy();
  });
  expect(await markup()).toEqual(before);
});
