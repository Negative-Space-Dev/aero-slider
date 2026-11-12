import { create, dots, expect, mount, settled, slider, test } from "./fixtures";
import { state } from "./helpers/state";

const buttonDots = `<div class="aero-slider__pagination"><button type="button" class="aero-slider__dot" aria-label="Go to slide {index}" style="width:10px;height:10px"></button></div>`;
/** A slider whose dots are named buttons, as the docs tell authors to write them. */
const withDots = (id: string, n: number, options: Parameters<typeof slider>[2] = {}) =>
  slider(id, n, { ...options, dots: false }).replace(/<\/div>$/, `${buttonDots}</div>`);
const index = async (page: Parameters<typeof state>[0]) => (await state(page, "s")).index;

// The dot template carries the semantics: a <button> named with an {index} placeholder.
test("dots copy the template's name with the slide number, and the current one is marked", async ({
  page,
}) => {
  await mount(page, withDots("s", 3));
  await create(page, "s");
  const pagination = page.locator("#s .aero-slider__pagination");
  await expect(pagination).toMatchAriaSnapshot(`
    - button "Go to slide 1"
    - button "Go to slide 2"
    - button "Go to slide 3"
  `);
  const current = pagination.locator("[aria-current]");
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute("aria-current", "true");
  await expect(current).toHaveAccessibleName("Go to slide 1");

  const dot = page.getByRole("button", { name: "Go to slide 3" });
  await dot.focus();
  await page.keyboard.press("Enter");
  await settled(page, "s");
  expect(await index(page)).toBe(2);
  await expect(dot).toHaveAttribute("aria-current", "true");
});

test("a template with no name or role gets none from the slider", async ({ page }) => {
  await mount(page, slider("s", 3));
  await create(page, "s");
  const dot = page.locator("#s .aero-slider__dot");
  await expect(dot).toHaveCount(3);
  await expect(dot.and(page.locator("[role], [tabindex], [aria-label]"))).toHaveCount(0);
});

// Playwright's role queries don't honour inert, though browsers drop inert elements from the
// accessibility tree. So this checks the attribute, and real Tab presses for the tab order.
test("windowed dots outside the window are inert and skipped by Tab", async ({ page }) => {
  await mount(page, withDots("s", 12, { nav: false }) + "<button id=after>after</button>");
  await create(page, "s", { maxDots: 5 });
  const pagination = page.locator("#s .aero-slider__pagination");
  await expect(pagination.locator(".aero-slider__dot:not([inert])")).toHaveCount(5);
  await expect(pagination.locator(".aero-slider__dot--hidden:not([inert])")).toHaveCount(0);

  await page.getByRole("button", { name: "Go to slide 1", exact: true }).focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("Tab");
  await expect(page.locator("#after")).toBeFocused();

  await page.getByRole("button", { name: "Go to slide 1", exact: true }).focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
  await settled(page, "s");
  expect(await index(page)).toBe(6);
  await expect(pagination.locator(".aero-slider__dot:not([inert])")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Go to slide 7" })).toBeFocused();
});

test("destroy() restores the pagination markup", async ({ page }) => {
  await mount(page, slider("s", 12) + slider("w", 12));
  const markup = () =>
    page.evaluate(() =>
      [...document.querySelectorAll(".aero-slider__pagination")].map((el) => el.outerHTML)
    );
  const before = await markup();
  expect(before[0]).toContain(dots.slice(dots.indexOf("<span"), dots.indexOf("</div>")));
  await create(page, "s");
  await create(page, "w", { maxDots: 5 });
  await page.evaluate(() => {
    window.sliders.s!.goTo(3, { instant: true });
    window.sliders.w!.goTo(8, { instant: true });
    window.sliders.s!.destroy();
    window.sliders.w!.destroy();
  });
  expect(await markup()).toEqual(before);
});

test("End from the first windowed dot moves focus to the last dot", async ({ page }) => {
  await mount(page, withDots("s", 12));
  await create(page, "s", { maxDots: 5 });
  await page.getByRole("button", { name: "Go to slide 1", exact: true }).focus();
  await page.keyboard.press("End");
  await settled(page, "s");
  await expect(page.getByRole("button", { name: "Go to slide 12" })).toBeFocused();
});

test("a focused dot keeps focus when the dots are rebuilt", async ({ page }) => {
  await mount(page, withDots("s", 3));
  await create(page, "s", { alignment: "left" });
  const buttons = page.locator("#s .aero-slider__dot");
  await buttons.nth(1).focus();
  await page.evaluate(() => window.sliders.s!.refresh());
  await expect(buttons.nth(1)).toBeFocused();

  // With two slides in view, left aligned, there are two stops: the third dot's place is gone.
  await buttons.nth(2).focus();
  await page.evaluate(() => {
    document.getElementById("s")!.style.setProperty("--slides-per-view", "2");
    window.sliders.s!.refresh();
  });
  await expect(buttons).toHaveCount(2);
  await expect(buttons.nth(1)).toBeFocused();
});
