import { type Page, create, expect, mount, slider, test } from "./fixtures";

const attributes = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const el = document.querySelector(selector)!;
    // classList rewrites the attribute, dropping stray whitespace, so compare its tokens.
    const value = (name: string) =>
      name === "class" ? [...el.classList].join(" ") : el.getAttribute(name);
    return Object.fromEntries(el.getAttributeNames().map((name) => [name, value(name)]));
  }, selector);

test("the container is a named carousel region", async ({ page }) => {
  await mount(page, slider("s", 3).replace('id="s"', 'id="s" aria-label="Featured"'));
  await create(page, "s");
  const region = page.getByRole("region", { name: "Featured" });
  await expect(region).toHaveAttribute("id", "s");
  await expect(region).toHaveAttribute("aria-roledescription", "carousel");
});

test("the author's role and role description stay, and destroy() restores the container", async ({
  page,
}) => {
  await mount(
    page,
    slider("s", 3).replace(
      'id="s"',
      'id="s" role="group" aria-roledescription="gallery" aria-label="Photos"'
    ) + slider("plain", 3)
  );
  const before = [await attributes(page, "#s"), await attributes(page, "#plain")];
  await create(page, "s");
  await create(page, "plain");
  await expect(page.getByRole("group", { name: "Photos" })).toHaveAttribute(
    "aria-roledescription",
    "gallery"
  );
  await page.evaluate(() => {
    window.sliders.s!.destroy();
    window.sliders.plain!.destroy();
  });
  expect([await attributes(page, "#s"), await attributes(page, "#plain")]).toEqual(before);
});

test("real slides are named groups that follow the slide count; clones stay hidden", async ({
  page,
}) => {
  await mount(page, slider("s", 3, { style: "--slides-per-view:2", nav: false, dots: false }));
  await create(page, "s", { loop: true });
  const track = page.locator("#s .aero-slider__track");
  await expect(track).toMatchAriaSnapshot(`
    - group "1 of 3": "0"
    - group "2 of 3": "1"
    - group "3 of 3": "2"
  `);
  await expect(track.locator("[data-aero-slider-index]").first()).toHaveAttribute(
    "aria-roledescription",
    "slide"
  );

  await page.evaluate(() => {
    const slide = document.createElement("div");
    slide.textContent = "new";
    window.sliders.s!.add(slide);
  });
  await expect(track).toMatchAriaSnapshot(`
    - group "1 of 4": "0"
    - group "2 of 4": "1"
    - group "3 of 4": "2"
    - group "4 of 4": "new"
  `);
});

test("a slide keeps the role or label its author gave it", async ({ page }) => {
  await mount(page, slider("s", 3, { nav: false, dots: false }));
  await page.evaluate(() => {
    const [first, second, third] = document.querySelectorAll("#s .aero-slider__track > *");
    first!.setAttribute("aria-label", "Intro");
    second!.setAttribute("role", "article");
    third!.outerHTML = `<a href="#card">card</a>`;
  });
  await create(page, "s");
  const track = page.locator("#s .aero-slider__track");
  await expect(track).toMatchAriaSnapshot(`
    - group "Intro": "0"
    - article: "1"
    - link "card"
  `);
  await expect(track.getByRole("article")).not.toHaveAttribute("aria-roledescription");
});

test("list item slides keep their list semantics", async ({ page }) => {
  await mount(
    page,
    `<div id="s" class="aero-slider" style="width:600px"><div class="aero-slider__viewport"><ul class="aero-slider__track" style="margin:0;padding:0;list-style:none"><li>A</li><li>B</li><li>C</li></ul></div></div>`
  );
  await create(page, "s");
  const items = page.locator("#s li[data-aero-slider-index]");
  await expect(items).toHaveCount(3);
  for (const item of await items.all()) await expect(item).not.toHaveAttribute("role");
  await expect(items.nth(1)).toHaveAttribute("aria-label", "2 of 3");
  await expect(page.locator("#s").getByRole("listitem")).toHaveCount(3);
});
