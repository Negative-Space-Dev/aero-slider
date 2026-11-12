import { type Page, create, expect, mount, slider, test } from "./fixtures";
import { recordEvents, takeEvents } from "./helpers/state";

test("the track is a polite live region without autoplay", async ({ page }) => {
  await mount(page, slider("s", 3));
  await create(page, "s");
  const track = page.locator("#s .aero-slider__track");
  await expect(track).toHaveAttribute("aria-live", "polite");
  await page.evaluate(() => window.sliders.s!.destroy());
  await expect(track).not.toHaveAttribute("aria-live");
});

test("the author's aria-live stays", async ({ page }) => {
  await mount(
    page,
    slider("s", 3).replace('class="aero-slider__track"', '$& aria-live="assertive"')
  );
  await create(page, "s", { autoplay: true });
  await expect(page.locator("#s .aero-slider__track")).toHaveAttribute("aria-live", "assertive");
});

for (const autoplay of [true, "continuous"] as const) {
  test(`autoplay ${autoplay} silences the track only while it runs`, async ({ page }) => {
    await mount(page, slider("s", 5, { style: "--slides-per-view:2" }));
    await recordEvents(page, "s");
    await create(page, "s", { autoplay });
    const track = page.locator("#s .aero-slider__track");
    const live = () => track.getAttribute("aria-live");

    expect(await takeEvents(page, "s")).toContain("autoplayStart");
    expect(await live()).toBe("off");
    await page.evaluate(() => window.sliders.s!.pause());
    expect(await takeEvents(page, "s")).toContain("autoplayStop");
    expect(await live()).toBe("polite");
    await page.evaluate(() => window.sliders.s!.resume());
    expect(await takeEvents(page, "s")).toContain("autoplayStart");
    expect(await live()).toBe("off");
    await page.evaluate(() => window.sliders.s!.update({ autoplay: false }));
    expect(await takeEvents(page, "s")).toContain("autoplayStop");
    expect(await live()).toBe("polite");
  });
}

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
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await press();
  expect(await autoplayEvents(page)).toEqual(["autoplayStop"]);
  await expect(toggle).toHaveAccessibleName("Start autoplay");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(root).toHaveClass(/aero-slider--paused/);

  await page.evaluate(() => window.sliders.s!.resume());
  expect(await autoplayEvents(page)).toEqual(["autoplayStart"]);
  await expect(toggle).toHaveAccessibleName("Pause autoplay");
  await expect(root).not.toHaveClass(/aero-slider--paused/);

  await page.evaluate(() => window.sliders.s!.pause());
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await press();
  expect(await autoplayEvents(page)).toEqual(["autoplayStop", "autoplayStart"]);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
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
