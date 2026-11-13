import {
  type Page,
  create,
  expect,
  failOnPageErrors,
  mount,
  settled,
  slider,
  test,
} from "./fixtures";

failOnPageErrors();

const FIELDS =
  '<div style="padding:40px"><input id="range" type="range" min="0" max="100" value="50" style="width:300px"><a id="link" href="#x" style="display:block;width:300px">link</a></div>';

async function withFields(page: Page, config = {}): Promise<void> {
  await mount(page, slider("s", 3, { inner: (i) => (i ? `<div>${i}</div>` : FIELDS) }));
  await create(page, "s", config);
}

/** Presses the middle of `selector` and drags 120px toward the start, then lets go. */
async function dragFrom(page: Page, selector: string): Promise<void> {
  const box = (await page.locator(selector).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) await page.mouse.move(x - step * 12, y);
  await page.mouse.up();
  await settled(page, "s");
}

const index = (page: Page) => page.evaluate(() => window.sliders.s!.currentIndex);
const range = (page: Page) => page.locator("#range").inputValue();

test("by default a drag on a range input moves its thumb, not the slider", async ({ page }) => {
  await withFields(page);
  await dragFrom(page, "#range");
  expect(await index(page)).toBe(0);
  expect(Number(await range(page))).toBeLessThan(50);
});

test("by default a drag that starts on a link still moves the slider", async ({ page }) => {
  await withFields(page);
  await dragFrom(page, "#link");
  expect(await index(page)).toBeGreaterThan(0); // a fast drag can carry two slides
});

test("a noDrag of your own replaces the default", async ({ page }) => {
  await withFields(page, { noDrag: "a" });
  await dragFrom(page, "#link");
  expect(await index(page)).toBe(0);
  await dragFrom(page, "#range");
  expect(await index(page)).toBeGreaterThan(0); // a fast drag can carry two slides
  expect(await range(page)).toBe("50");
});
