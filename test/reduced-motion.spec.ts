import {
  type Page,
  create,
  expect,
  expectNear,
  failOnPageErrors,
  mount,
  recordEvents,
  slider,
  state,
  test,
} from "./fixtures";

failOnPageErrors();

const animationCount = (page: Page) =>
  page.evaluate(
    () => document.querySelector("#s .aero-slider__track")!.getAnimations({ subtree: true }).length
  );

test("turning reduced motion on lands an eased scroll in flight at once", async ({ page }) => {
  await mount(page, slider("s", 5, { style: "--aero-slide-gap:10px" }));
  await create(page, "s", { scrollDuration: 2000 });
  await page.evaluate(() => window.sliders.s!.goTo(4));
  await page.waitForFunction(
    () => document.querySelector("#s .aero-slider__track")!.scrollLeft > 50
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() => state(page, "s"), { timeout: 1000 })
    .toEqual({ index: 4, position: 2440 });
});

test("under reduced motion, goTo() jumps at once, with or without scrollDuration", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mount(
    page,
    slider("native", 5, { style: "--aero-slide-gap:10px" }) +
      slider("eased", 5, { style: "--aero-slide-gap:10px" })
  );
  await create(page, "native");
  await create(page, "eased", { scrollDuration: 300 });
  const offsets = await page.evaluate(() =>
    ["native", "eased"].map((id) => {
      window.sliders[id]!.goTo(1);
      return document.querySelector(`#${id} .aero-slider__track`)!.scrollLeft;
    })
  );
  expect(offsets).toEqual([610, 610]);
});

test("reduced motion stops continuous autoplay, keeps a rebuild still, and lifting it restarts", async ({
  page,
}) => {
  await mount(page, slider("s", 4, { style: "--aero-slides-per-view:3;--aero-slide-gap:10px" }));
  await create(page, "s", { autoplay: "continuous", autoplaySpeed: 600 });
  expect(await animationCount(page)).toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => animationCount(page)).toBe(0);

  await page.evaluate(() => window.sliders.s!.update({}));
  const slide = page.locator("#s .aero-slider__track > *").nth(6);
  const x = (await slide.boundingBox())!.x;
  await page.waitForTimeout(500);
  expect(await animationCount(page)).toBe(0);
  expectNear((await slide.boundingBox())!.x, x, 0.5);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => animationCount(page)).toBeGreaterThan(0);
});

test("reduced motion stops interval autoplay, and lifting it restarts", async ({ page }) => {
  await mount(page, slider("s", 4));
  await create(page, "s", { loop: true, autoplay: true, autoplayInterval: 300 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const changes = await recordEvents(page, "s", ["slideChange"]);
  await page.waitForTimeout(700);
  expect(await changes()).toEqual([]);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(async () => (await changes()).length).toBeGreaterThan(0);
});
