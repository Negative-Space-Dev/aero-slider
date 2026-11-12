import { type Page, create, expect, mount, settled, slider, test } from "./fixtures";
import { state } from "./helpers/state";

for (const key of ["Enter", " "]) {
  test(`${key === " " ? "Space" : key} on a nav button that disables hands focus to the other`, async ({
    page,
  }) => {
    await mount(page, slider("s", 3, { dots: false }));
    await create(page, "s");
    const prev = page.getByRole("button", { name: "Previous" });
    const next = page.getByRole("button", { name: "Next" });

    await next.focus();
    await page.keyboard.press(key);
    await settled(page, "s");
    await expect(next).toBeFocused();
    await page.keyboard.press(key);
    await settled(page, "s");
    expect((await state(page, "s")).index).toBe(2);
    await expect(next).toBeDisabled();
    await expect(prev).toBeFocused();

    await page.keyboard.press(key);
    await page.keyboard.press(key);
    await settled(page, "s");
    expect((await state(page, "s")).index).toBe(0);
    await expect(prev).toBeDisabled();
    await expect(next).toBeFocused();
  });
}

test("focus goes to the container when both nav buttons disable", async ({ page }) => {
  await mount(page, slider("s", 2, { dots: false }));
  await create(page, "s");
  await page.getByRole("button", { name: "Next" }).focus();
  await page.evaluate(() => window.sliders.s!.remove(1));
  await expect(page.locator("#s")).toBeFocused();
});

test("the container is the slider's one tab stop, and shows focus", async ({ page }) => {
  await mount(
    page,
    `<button id="before">before</button>${slider("s", 3, { nav: false, dots: false })}<button id="after">after</button>`
  );
  await create(page, "s");
  await page.locator("#before").focus();
  await page.keyboard.press("Tab");
  const root = page.locator("#s");
  await expect(root).toBeFocused();
  expect(await root.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Tab");
  await expect(page.locator("#after")).toBeFocused();
  await expect(page.locator("#s .aero-slider__track")).toHaveAttribute("tabindex", "-1");
});

test("the author's tabindex on the track stays, and the track shows focus", async ({ page }) => {
  await mount(
    page,
    slider("s", 3, { nav: false, dots: false }).replace(
      'class="aero-slider__track"',
      '$& tabindex="0"'
    )
  );
  await create(page, "s");
  const track = page.locator("#s .aero-slider__track");
  await page.locator("#s").focus();
  await page.keyboard.press("Tab");
  await expect(track).toBeFocused();
  expect(await track.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
  await page.evaluate(() => window.sliders.s!.destroy());
  await expect(page.locator("#s .aero-slider__track")).toHaveAttribute("tabindex", "0");
});

test("a focus ring inside a slide draws inside its box, unless the page says otherwise", async ({
  page,
}) => {
  const card = (i: number) =>
    `<a href="#c${i}" id="c${i}" style="align-self:stretch">Card ${i}</a>`;
  await mount(
    page,
    `<button id="before">before</button>${slider("s", 3, { inner: card, nav: false, dots: false })}`,
    { head: "<style>#c1:focus-visible { outline-offset: 4px }</style>" }
  );
  await create(page, "s");
  const ring = (id: string) =>
    page.locator(id).evaluate((el) => {
      const { outlineStyle, outlineOffset } = getComputedStyle(el);
      return { visible: outlineStyle !== "none", offset: outlineOffset };
    });
  await page.locator("#before").focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.locator("#c0")).toBeFocused();
  expect(await ring("#c0")).toEqual({ visible: true, offset: "-2px" });
  await page.keyboard.press("Tab");
  await expect(page.locator("#c1")).toBeFocused();
  expect(await ring("#c1")).toEqual({ visible: true, offset: "4px" });
});

const linked = (i: number) => `<div><a href="#s${i}" id="l${i}">link ${i}</a></div>`;
const fullyShown = (page: Page, i: number) =>
  page.evaluate((i) => {
    const slide = document
      .querySelector(`#s [data-aero-slider-index="${i}"]`)!
      .getBoundingClientRect();
    const track = document.querySelector("#s .aero-slider__track")!.getBoundingClientRect();
    return slide.left >= track.left - 1 && slide.right <= track.right + 1;
  }, i);

test("tabbing into a partly shown slide brings it into view", async ({ page }) => {
  await mount(
    page,
    `<button id="before">before</button>${slider("s", 4, { inner: linked, nav: false, dots: false, style: "--slides-per-view:1.5" })}`
  );
  await create(page, "s");
  expect(await fullyShown(page, 1)).toBe(false);
  await page.locator("#before").focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
  await expect(page.locator("#l1")).toBeFocused();
  await expect.poll(() => state(page, "s").then((s) => s.index)).toBe(1);
  await settled(page, "s");
  expect(await fullyShown(page, 1)).toBe(true);
});

test("tabbing to a hidden slide still lands it in view", async ({ page }) => {
  await mount(page, slider("s", 4, { inner: linked, nav: false, dots: false }));
  await create(page, "s");
  await page.locator("#l0").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#l1")).toBeFocused();
  await expect.poll(() => state(page, "s").then((s) => s.index)).toBe(1);
  await settled(page, "s");
  expect(await fullyShown(page, 1)).toBe(true);
});

test("a click into a partly shown slide doesn't move the slider", async ({ page }) => {
  await mount(
    page,
    slider("s", 4, { inner: linked, nav: false, dots: false, style: "--slides-per-view:1.5" })
  );
  await create(page, "s");
  await page.locator("#l1").click();
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 100)))
  );
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 0, position: 0 });
});

test("Previous hands focus to Next when it disables on the way back to the start", async ({
  page,
}) => {
  await mount(page, slider("s", 2));
  await create(page, "s");
  const next = page.locator("#s .aero-slider__nav--next");
  const prev = page.locator("#s .aero-slider__nav--prev");
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(prev).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(next).toBeFocused();
});

test("handing focus on doesn't scroll the page back to the slider", async ({ page }) => {
  await mount(page, `${slider("s", 3)}<div style="height:3000px"></div>`);
  await create(page, "s");
  await page.locator("#s .aero-slider__nav--next").click();
  await settled(page, "s");
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.evaluate(() => window.sliders.s!.next());
  await settled(page, "s");
  await expect(page.locator("#s .aero-slider__nav--next")).toBeDisabled();
  expect(await page.evaluate(() => window.scrollY)).toBe(1500);
});

test("a click into a text field in a partly shown slide doesn't move the slider", async ({
  page,
}) => {
  await mount(
    page,
    slider("s", 4, {
      style: "--slides-per-view:1.5",
      inner: (i) => `<input id="field${i}" style="width:80%">`,
    })
  );
  await create(page, "s", { alignment: "left" });
  await page.locator("#field1").click({ position: { x: 5, y: 5 } });
  await settled(page, "s");
  expect(await page.evaluate(() => window.sliders.s!.currentIndex)).toBe(0);
});
