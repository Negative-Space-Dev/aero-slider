import { type Page, create, expect, mount, slider, test } from "./fixtures";

const attributes = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const el = document.querySelector(selector)!;
    // classList rewrites the attribute, dropping stray whitespace, so compare its tokens.
    const value = (name: string) =>
      name === "class" ? [...el.classList].join(" ") : el.getAttribute(name);
    return Object.fromEntries(el.getAttributeNames().map((name) => [name, value(name)]));
  }, selector);

const ARIA = "[role], [aria-label], [aria-roledescription]";

// Roles and names are the markup's job: the slider writes none of its own.
test("the slider adds no role or name to the container or the slides", async ({ page }) => {
  await mount(page, slider("s", 3, { nav: false, dots: false }));
  await create(page, "s");
  await expect(page.locator("#s").and(page.locator(ARIA))).toHaveCount(0);
  await expect(page.locator("#s [data-aero-slider-index]").and(page.locator(ARIA))).toHaveCount(0);
});

test("the author's role, description and name stay, and destroy() restores the container", async ({
  page,
}) => {
  await mount(
    page,
    slider("s", 3).replace(
      'id="s"',
      'id="s" role="region" aria-roledescription="carousel" aria-label="Photos"'
    ) + slider("plain", 3)
  );
  const before = [await attributes(page, "#s"), await attributes(page, "#plain")];
  await create(page, "s");
  await create(page, "plain");
  await expect(page.getByRole("region", { name: "Photos" })).toHaveAttribute(
    "aria-roledescription",
    "carousel"
  );
  await page.evaluate(() => {
    window.sliders.s!.destroy();
    window.sliders.plain!.destroy();
  });
  expect([await attributes(page, "#s"), await attributes(page, "#plain")]).toEqual(before);
});

test("slides keep the roles and names their author gave them; clones are hidden", async ({
  page,
}) => {
  await mount(page, slider("s", 3, { style: "--aero-slides-per-view:2", nav: false, dots: false }));
  await page.evaluate(() => {
    document.querySelectorAll("#s .aero-slider__slides > *").forEach((slide, i) => {
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "slide");
      slide.setAttribute("aria-label", `${i + 1} of 3`);
    });
  });
  await create(page, "s", { loop: true });
  const track = page.locator("#s .aero-slider__track");
  await expect(track).toMatchAriaSnapshot(`
    - group "1 of 3": "0"
    - group "2 of 3": "1"
    - group "3 of 3": "2"
  `);
  const clones = track.locator("[data-aero-slider-clone]");
  expect(await clones.count()).toBeGreaterThan(0);
  for (const clone of await clones.all())
    await expect(clone).toHaveAttribute("aria-hidden", "true");
});
