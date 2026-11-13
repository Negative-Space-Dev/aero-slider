import { type Page, create, expect, mount, settled, test } from "./fixtures";

// Slides sized by the page, not by --aero-slides-per-view: each 200px wide until one changes. The
// fixed height keeps the track's own box the same when a slide widens.
const mixed = (n: number) =>
  `<div id="s" class="aero-slider" style="width:600px"><div class="aero-slider__track">${Array.from(
    { length: n },
    (_, i) => `<div style="flex:none;width:200px;height:100px">${i}</div>`
  ).join("")}</div></div>`;

/** Resolves with how many `aero:resized` events `#s` dispatched during `change` and the frames after it. */
const resizedDuring = (page: Page, change: () => void) =>
  page.evaluate(async (change) => {
    let count = 0;
    const el = document.getElementById("s")!;
    const listener = () => count++;
    el.addEventListener("aero:resized", listener);
    new Function(`(${change})()`)();
    for (let i = 0; i < 5; i++) await new Promise(requestAnimationFrame);
    el.removeEventListener("aero:resized", listener);
    return count;
  }, change.toString());

/** How far slide `index` rests from the track's start edge, in px. */
const offsetOf = (page: Page, index: number) =>
  page.evaluate((index) => {
    const track = document.querySelector("#s .aero-slider__track")!;
    const slide = track.querySelector(`[data-aero-slider-index="${index}"]`)!;
    return Math.round(slide.getBoundingClientRect().left - track.getBoundingClientRect().left);
  }, index);

test("a later slide changing width re-measures", async ({ page }) => {
  await mount(page, mixed(8));
  await create(page, "s", { alignment: "start" });
  await settled(page, "s");

  const resized = await resizedDuring(page, () => {
    document.querySelector<HTMLElement>('#s [data-aero-slider-index="1"]')!.style.width = "350px";
  });
  expect(resized).toBe(1);

  await page.evaluate(() => window.sliders.s!.goTo(3, { instant: true }));
  await settled(page, "s");
  expect(await offsetOf(page, 3)).toBe(0);
  expect(await page.evaluate(() => window.sliders.s!.currentIndex)).toBe(3);

  // The scroll that follows reads the new positions too: 750px is where slide 3 now rests.
  await page.evaluate(() => {
    document.querySelector("#s .aero-slider__track")!.scrollTo({ left: 550, behavior: "instant" });
  });
  await settled(page, "s");
  expect(await page.evaluate(() => window.sliders.s!.currentIndex)).toBe(2);
});

test("a slide that stays the same size announces no resize", async ({ page }) => {
  await mount(page, mixed(8));
  await create(page, "s", { alignment: "start" });
  const resized = await resizedDuring(page, () => {
    document.querySelector<HTMLElement>('#s [data-aero-slider-index="1"]')!.style.color = "red";
  });
  expect(resized).toBe(0);
});

test("slides added before refresh() are tracked, and removed ones are not", async ({ page }) => {
  await mount(page, mixed(6));
  await create(page, "s", { alignment: "start" });
  await settled(page, "s");

  await page.evaluate(() => {
    const track = document.querySelector("#s .aero-slider__track")!;
    const removed = track.querySelector<HTMLElement>('[data-aero-slider-index="1"]')!;
    removed.remove();
    for (const id of ["a", "b"]) {
      const slide = document.createElement("div");
      slide.id = id;
      slide.style.cssText = "flex:none;width:200px;height:100px";
      track.append(slide);
    }
    window.sliders.s!.refresh();
    // Still in the document, so the observer would report it if it were still observed.
    removed.id = "removed";
    document.body.append(removed);
  });
  await settled(page, "s");

  const removedResized = await resizedDuring(page, () => {
    document.getElementById("removed")!.style.width = "300px";
  });
  expect(removedResized).toBe(0);

  const resized = await resizedDuring(page, () => {
    document.getElementById("a")!.style.width = "350px";
  });
  expect(resized).toBe(1);

  await page.evaluate(() => window.sliders.s!.goTo(6, { instant: true }));
  await settled(page, "s");
  expect(await page.evaluate(() => window.sliders.s!.currentIndex)).toBe(6);
  // The track ends on its last slide: 5 slides of 200px and one of 350px ahead of it, less the view.
  expect(
    await page.evaluate(() => document.querySelector("#s .aero-slider__track")!.scrollLeft)
  ).toBe(5 * 200 + 350 + 200 - 600);
});
