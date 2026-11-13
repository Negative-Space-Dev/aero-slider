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

// A gap between fixed-width slides resizes no element, so no observer reports it. The track's
// scroll range shows it, and the slider looks at that when a scroll comes to rest.
for (const first of ["goTo", "scroll"] as const) {
  test(`a new gap is measured once a ${first} brings the track to rest`, async ({ page }) => {
    await mount(page, mixed(8));
    await create(page, "s", { alignment: "start" });
    await settled(page, "s");
    await page.evaluate(() => {
      const el = document.getElementById("s")!;
      el.addEventListener("aero:resized", () => (el.dataset.resized = "yes"));
      el.style.setProperty("--aero-slide-gap", "20px");
    });
    const scrollToSlide = (index: number) =>
      page.evaluate((left) => {
        document.querySelector("#s .aero-slider__track")!.scrollTo({ left, behavior: "smooth" });
      }, index * 220);

    if (first === "goTo") await page.evaluate(() => window.sliders.s!.goTo(3));
    else await scrollToSlide(3);
    await settled(page, "s");
    await expect(page.locator("#s")).toHaveAttribute("data-resized", "yes");
    expect(await offsetOf(page, 3)).toBe(0);
    expect(await page.evaluate(() => window.sliders.s!.currentIndex)).toBe(3);

    await scrollToSlide(5);
    await settled(page, "s");
    expect(await page.evaluate(() => window.sliders.s!.currentIndex)).toBe(5);

    await page.evaluate(() => window.sliders.s!.goTo(1, { instant: true }));
    expect(await offsetOf(page, 1)).toBe(0);
  });
}

// The track's scroll range stays the same, so only watching each slide shows the change.
test("two slides trading width re-measure", async ({ page }) => {
  await mount(page, mixed(8));
  await create(page, "s", { alignment: "start" });
  await settled(page, "s");
  const resized = await resizedDuring(page, () => {
    document.querySelector<HTMLElement>('#s [data-aero-slider-index="1"]')!.style.width = "300px";
    document.querySelector<HTMLElement>('#s [data-aero-slider-index="2"]')!.style.width = "100px";
  });
  expect(resized).toBe(1);
  await page.evaluate(() => window.sliders.s!.goTo(2, { instant: true }));
  expect(await offsetOf(page, 2)).toBe(0);
});

test("a loop with one wider slide rests on, steps to and reports the right slide", async ({
  page,
}) => {
  await mount(page, mixed(6));
  await page.evaluate(() => {
    document.querySelector<HTMLElement>("#s .aero-slider__track > :nth-child(3)")!.style.width =
      "400px";
  });
  await create(page, "s", { alignment: "start", loop: true });
  await settled(page, "s");
  const index = () => page.evaluate(() => window.sliders.s!.currentIndex);

  for (const slide of [4, 2, 5, 0]) {
    await page.evaluate((slide) => window.sliders.s!.goTo(slide), slide);
    await settled(page, "s");
    expect(await index()).toBe(slide);
    expect(await offsetOf(page, slide)).toBe(0);
  }
  // Slides 0 and 1 are 200px each, and slide 2 is 400px: a scroll past each lands on the next.
  for (const [by, slide] of [
    [200, 1],
    [200, 2],
    [400, 3],
  ] as const) {
    await page.evaluate((by) => {
      document.querySelector("#s .aero-slider__track")!.scrollBy({ left: by, behavior: "smooth" });
    }, by);
    await settled(page, "s");
    expect(await index()).toBe(slide);
    expect(await offsetOf(page, slide)).toBe(0);
  }
});

// Without snapping the browser does not pull the track off the stale target, so the move ends on
// another slide's new position: the re-measure must still rest on the slide that was asked for.
test('a goTo() after a new gap rests on the slide asked for, with snap: "none"', async ({
  page,
}) => {
  await mount(page, mixed(8));
  await create(page, "s", { alignment: "start", snap: "none" });
  await settled(page, "s");
  await page.evaluate(() => {
    document.getElementById("s")!.style.setProperty("--aero-slide-gap", "200px");
    window.sliders.s!.goTo(4);
  });
  await settled(page, "s");
  await expect.poll(() => offsetOf(page, 4)).toBe(0);
  expect(await page.evaluate(() => window.sliders.s!.currentIndex)).toBe(4);
});

// Stale positions would take the real slide for a clone and jump the track a lap away.
test("a scroll after a new gap keeps a looped track on the slide it reached", async ({ page }) => {
  await mount(page, mixed(6));
  await create(page, "s", { alignment: "start", loop: true, snap: "none" });
  await settled(page, "s");
  await page.evaluate(() => {
    document.getElementById("s")!.style.setProperty("--aero-slide-gap", "20px");
    // Six clones sit ahead of the real slides, so slide 5 is the twelfth child.
    document
      .querySelector("#s .aero-slider__track")!
      .scrollTo({ left: 11 * 220, behavior: "smooth" });
  });
  await settled(page, "s");
  await expect.poll(() => page.evaluate(() => window.sliders.s!.currentIndex)).toBe(5);
  expect(await offsetOf(page, 5)).toBe(0);
});

test('a scroll after a new gap stays where it stopped, with snap: "none"', async ({ page }) => {
  await mount(page, mixed(8));
  await create(page, "s", { alignment: "start", snap: "none" });
  await settled(page, "s");
  await page.evaluate(() => {
    const el = document.getElementById("s")!;
    el.addEventListener("aero:resized", () => (el.dataset.resized = "yes"));
    el.style.setProperty("--aero-slide-gap", "200px");
    el.querySelector(".aero-slider__track")!.scrollTo({ left: 950, behavior: "smooth" });
  });
  await settled(page, "s");
  await expect(page.locator("#s")).toHaveAttribute("data-resized", "yes");
  await settled(page, "s");
  // Slides now rest every 400px, so 950px is nearest slide 2 at 800px.
  expect(await page.evaluate(() => window.sliders.s!.currentIndex)).toBe(2);
  expect(
    await page.evaluate(() => document.querySelector("#s .aero-slider__track")!.scrollLeft)
  ).toBe(950);
});
