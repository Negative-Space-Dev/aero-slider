import { type Page, create, expect, failOnPageErrors, mount, slider, test } from "./fixtures";

declare global {
  interface Window {
    /** For each `measuring-card` constructed, the track's child count at that moment. */
    constructed: number[];
  }
}

failOnPageErrors();

// A component that sizes itself in its constructor, as many theme components do. A clone
// upgrades when it enters the page, so each insertion that runs these constructors lays out the
// page once.
const measuringCard = `<script>
customElements.define("measuring-card", class extends HTMLElement {
  constructor() {
    super();
    this.offsetHeight;
    (window.constructed ??= []).push(this.closest(".aero-slider__track")?.children.length ?? 0);
  }
});
</script>`;

const mountCards = (page: Page, count: number) =>
  mount(
    page,
    slider("s", count, {
      style: "--aero-slides-per-view:3",
      inner: (i) => `<measuring-card>${i}</measuring-card>`,
    }),
    { head: measuringCard }
  );

test("loop clones of a custom element upgrade in one insertion per side", async ({ page }) => {
  await mountCards(page, 13);
  await page.evaluate(() => (window.constructed = []));
  await create(page, "s", { loop: true });

  const constructed = await page.evaluate(() => window.constructed);
  expect(constructed).toHaveLength(26);
  // Every leading clone went in together, then every trailing one.
  expect(constructed).toEqual([...Array(13).fill(26), ...Array(13).fill(39)]);
});

test("loop clones keep their order around the real slides", async ({ page }) => {
  // Two slides in view need four clones a side, more than the three slides.
  await mount(page, slider("s", 3, { style: "--aero-slides-per-view:2" }));
  await create(page, "s", { loop: true });
  const order = await page
    .locator("#s .aero-slider__track > *")
    .evaluateAll((children) => children.map((child) => child.textContent));
  expect(order).toEqual(["2", "0", "1", "2", "0", "1", "2", "0", "1", "2", "0"]);
});

test("setting up a loop lays the page out as often for 24 slides as for 6", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "layout counts come from the Chrome DevTools Protocol");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const layoutCount = async () =>
    (await cdp.send("Performance.getMetrics")).metrics.find((m) => m.name === "LayoutCount")!.value;

  const layouts: number[] = [];
  for (const count of [6, 24]) {
    await mountCards(page, count);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const before = await layoutCount();
    await create(page, "s", { loop: true });
    layouts.push((await layoutCount()) - before);
    expect(await page.locator("#s [data-aero-slider-clone]").count()).toBe(count * 2);
  }
  expect(layouts[1]).toBe(layouts[0]);
  expect(layouts[0]).toBeLessThanOrEqual(3);
});
