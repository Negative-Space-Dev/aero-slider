import { type Page, create, expect, mount, slider, test } from "./fixtures";
import { imageRequests } from "./helpers/requests";

// src before loading: cloning a live image in this order is what used to start the fetch.
const lazyImages = (set: string, count = 20) =>
  slider("s", count, {
    style: "--aero-slides-per-view:4",
    dots: false,
    inner: (i) => `<img src="/img/${set}/${i}.png" loading="lazy" width="150" height="150" alt="">`,
  });

/** Every image in `#s`, clones included, with its path and its distance from the visible area. */
const imagePlaces = (page: Page) =>
  page.evaluate(() => {
    const view = document.querySelector("#s .aero-slider__track")!.getBoundingClientRect();
    return Array.from(document.querySelectorAll<HTMLImageElement>("#s img"), (img) => {
      const box = img.getBoundingClientRect();
      const distance = Math.max(0, box.left - view.right, view.left - box.right);
      return {
        path: new URL(img.src).pathname,
        distance,
        clone: !!img.closest("[data-aero-slider-clone]"),
      };
    });
  });

test("a looping slider far below the fold fetches no images", async ({ page }) => {
  const requests = await imageRequests(page);
  await mount(page, `<div style="height:6000px"></div>${lazyImages("a")}`);
  await create(page, "s", { loop: true });
  await page.waitForTimeout(500);
  expect(requests()).toEqual([]);
});

// Browsers also fetch lazy images within a margin of the view, and on a loop that margin takes in
// the clones ahead of the first slide, so the bound is distance, not count.
test("a looping slider in view fetches nothing farther away than a plain one", async ({ page }) => {
  const requests = await imageRequests(page);
  await mount(page, lazyImages("a", 40));
  await create(page, "s", { alignment: "start" });
  await page.waitForTimeout(500);
  const fetched = new Set(requests());
  const plain = (await imagePlaces(page)).filter((image) => fetched.has(image.path));
  const reach = Math.max(...plain.map((image) => image.distance));

  const before = requests().length;
  await mount(page, lazyImages("b", 40));
  await create(page, "s", { alignment: "start", loop: true });
  await page.waitForTimeout(500);
  const places = await imagePlaces(page);
  const far = requests()
    .slice(before)
    .filter(
      (path) => !places.some((image) => image.path === path && image.distance <= reach + 150)
    );
  expect(far).toEqual([]);
});

test("clones load their images once scrolled into view", async ({ page }) => {
  await imageRequests(page);
  await mount(page, `<div style="height:6000px"></div>${lazyImages("a")}`);
  await create(page, "s", { loop: true });
  await page.locator("#s").scrollIntoViewIfNeeded();
  await expect
    .poll(async () => {
      const onScreen = (await imagePlaces(page)).filter((i) => i.clone && i.distance === 0);
      return onScreen.length;
    })
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const view = document.querySelector("#s .aero-slider__track")!.getBoundingClientRect();
        const clones = document.querySelectorAll<HTMLImageElement>(
          "#s [data-aero-slider-clone] img"
        );
        return Array.from(clones)
          .filter((img) => {
            const box = img.getBoundingClientRect();
            return box.right > view.left && box.left < view.right;
          })
          .every((img) => img.complete && img.naturalWidth === 1);
      })
    )
    .toBe(true);
});

const VIDEO = `<video muted loop playsinline preload="auto" width="150" height="84"><source src="/test/assets/clip.webm" type="video/webm"></video>`;

// WebKit never starts loading media that arrived from another document with <source> children.
for (const [where, markup] of [
  [
    "inside a slide",
    slider("s", 4, { style: "--aero-slides-per-view:2", dots: false, inner: () => VIDEO }),
  ],
  [
    "that is the slide itself",
    `<div id="s" class="aero-slider" style="width:600px;--aero-slides-per-view:2"><div class="aero-slider__viewport"><div class="aero-slider__track">${VIDEO.repeat(4)}</div></div></div>`,
  ],
] as const) {
  test(`looped clones of a video ${where} load`, async ({ page }) => {
    await mount(page, markup);
    await create(page, "s", { loop: true });
    const cloneStates = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLVideoElement>("#s video"))
          .filter((video) => video.closest("[data-aero-slider-clone]"))
          .map((video) => video.readyState > 0)
      );
    expect((await cloneStates()).length).toBeGreaterThan(0);
    await expect.poll(async () => (await cloneStates()).every(Boolean)).toBe(true);
  });
}
