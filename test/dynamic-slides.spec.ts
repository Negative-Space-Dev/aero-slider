import { type Page, create, expect, mount, settled, slider, test } from "./fixtures";
import { recordEvents, state, takeEvents } from "./helpers/state";

/** The label of the real slide resting at the track's start edge. */
const showing = (page: Page) =>
  page.evaluate(() => {
    const track = document.querySelector<HTMLElement>("#s .aero-slider__track")!;
    const left = track.getBoundingClientRect().left;
    const slides = Array.from(
      track.querySelectorAll<HTMLElement>(".aero-slider__slides > :not([data-aero-slider-clone])")
    );
    return slides.find((slide) => Math.abs(slide.getBoundingClientRect().left - left) < 2)
      ?.textContent;
  });

/** Edits the track's real slides in the page, then refreshes the slider. */
const edit = (page: Page, id: string, change: "prepend" | "append" | number | "all") =>
  page.evaluate(
    ([id, change]) => {
      const track = document.querySelector<HTMLElement>(`#${id} .aero-slider__track`)!;
      if (change === "all") track.querySelector(".aero-slider__slides")!.replaceChildren();
      else if (typeof change === "number")
        track.querySelector(`[data-aero-slider-index="${change}"]`)!.remove();
      else {
        const slide = document.createElement("div");
        slide.innerHTML = "<div>new</div>";
        track.querySelector(".aero-slider__slides")![change](slide);
      }
      window.sliders[id]!.refresh();
    },
    [id, change] as const
  );

test.describe("on slide 2 of 5", () => {
  test.beforeEach(async ({ page }) => {
    await mount(page, slider("s", 5));
    await create(page, "s");
    await page.evaluate(() => window.sliders.s!.goTo(2, { instant: true }));
    await recordEvents(page, "s");
  });

  for (const [change, label] of [
    [0, "3"],
    ["prepend", "1"],
    ["append", "2"],
    [2, "3"],
  ] as const) {
    test(`refresh() after ${change} rests on the same index`, async ({ page }) => {
      await edit(page, "s", change);
      expect(await state(page, "s")).toEqual({ index: 2, position: 1200 });
      expect(await showing(page)).toBe(label);
      expect(await takeEvents(page, "s")).not.toContainEqual(expect.stringMatching(/slideChange/));
    });
  }
});

for (const loop of [false, true]) {
  test(`replacing every slide${loop ? " in a loop" : ""} rests on the same index`, async ({
    page,
  }) => {
    await mount(page, slider("s", 6));
    await create(page, "s", { loop });
    await page.evaluate(() => window.sliders.s!.goTo(3, { instant: true }));
    await settled(page, "s");
    const swap = (toStart: boolean) =>
      page.evaluate((toStart) => {
        const track = document.querySelector<HTMLElement>("#s .aero-slider__track")!;
        const slides = ["a", "b", "c", "d", "e"].map((label) => {
          const slide = document.createElement("div");
          slide.innerHTML = `<div>${label}</div>`;
          return slide;
        });
        track.querySelector(".aero-slider__slides")!.replaceChildren(...slides);
        window.sliders.s!.refresh();
        if (toStart) window.sliders.s!.goTo(0, { instant: true });
        // Read in the same task, before the browser can paint anything in between.
        const left = track.getBoundingClientRect().left;
        return Array.from(track.querySelector(".aero-slider__slides")!.children).find(
          (slide) => Math.abs(slide.getBoundingClientRect().left - left) < 2
        )?.textContent;
      }, toStart);

    expect(await swap(false)).toBe("d");
    expect(await page.evaluate(() => window.sliders.s!.slideCount)).toBe(5);
    await expect(page.locator("#s .aero-slider__slides > [data-aero-slider-index]")).toHaveCount(5);
    expect(await swap(true)).toBe("a");
    await settled(page, "s");
    expect((await state(page, "s")).index).toBe(0);
    expect(await showing(page)).toBe("a");
  });
}

test("removing the last slide while on it announces the new index", async ({ page }) => {
  await mount(page, slider("s", 5));
  await create(page, "s");
  await page.evaluate(() => window.sliders.s!.goTo(4, { instant: true }));
  await recordEvents(page, "s");
  await edit(page, "s", 4);
  expect(await state(page, "s")).toEqual({ index: 3, position: 1800 });
  expect(await takeEvents(page, "s")).toContain("slideChange:3");
  await expect(page.locator("#s .aero-slider__nav--next")).toBeDisabled();
  await expect(page.locator("#s .aero-slider__dot").nth(3)).toHaveClass(/--active/);
});

test("a resize that lowers the last stop announces the new index", async ({ page }) => {
  await mount(page, slider("s", 6, { style: "--aero-slides-per-view:2" }));
  await create(page, "s", { alignment: "start" });
  await page.evaluate(() => window.sliders.s!.goTo(4, { instant: true }));
  await recordEvents(page, "s");
  await page.evaluate(() =>
    document.getElementById("s")!.style.setProperty("--aero-slides-per-view", "3")
  );
  await expect.poll(() => page.evaluate(() => window.events.s)).toContain("slideChange:3");
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 3, position: 600 });
  await expect(page.locator("#s .aero-slider__nav--next")).toBeDisabled();
  await expect(page.locator("#s .aero-slider__dot")).toHaveCount(4);
});

test("synced thumbnails follow a slide removed from both", async ({ page }) => {
  await mount(page, slider("s", 5) + slider("thumbs", 5, { style: "--aero-slides-per-view:5" }));
  await create(page, "s");
  await create(page, "thumbs");
  await page.evaluate(() => {
    window.syncThumbnails(window.sliders.s!, window.sliders.thumbs!);
    window.sliders.s!.goTo(2, { instant: true });
    for (const id of ["thumbs", "s"]) {
      document.querySelector(`#${id} [data-aero-slider-index="0"]`)!.remove();
      window.sliders[id]!.refresh();
    }
  });
  await expect(page.locator("#thumbs .aero-slider__thumb--active")).toHaveText("3");
  expect(await page.evaluate(() => window.sliders.thumbs!.currentIndex)).toBe(2);
});

test("synced thumbnails mark the current one after every slide is replaced", async ({ page }) => {
  await mount(page, slider("s", 5) + slider("thumbs", 5, { style: "--aero-slides-per-view:5" }));
  await create(page, "s");
  await create(page, "thumbs");
  await page.evaluate(() => {
    window.syncThumbnails(window.sliders.s!, window.sliders.thumbs!);
    for (const id of ["thumbs", "s"]) {
      const slides = ["a", "b", "c"].map((label) => {
        const slide = document.createElement("div");
        slide.innerHTML = `<div>${label}</div>`;
        return slide;
      });
      document.querySelector(`#${id} .aero-slider__slides`)!.replaceChildren(...slides);
      window.sliders[id]!.refresh();
    }
  });
  await expect(page.locator("#thumbs .aero-slider__thumb--active[aria-current]")).toHaveText("a");
});

for (const loop of [false, true]) {
  test(`removing every slide${loop ? " from a loop" : ""} leaves a safe empty slider`, async ({
    page,
  }) => {
    const errors: Error[] = [];
    page.on("pageerror", (error) => errors.push(error));
    await mount(page, slider("s", 4));
    await create(page, "s", { loop });
    await edit(page, "s", "all");
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => setTimeout(done))));
    expect(errors).toEqual([]);
    await expect(page.locator("#s .aero-slider__slides > *")).toHaveCount(0);
    await expect(page.locator("#s .aero-slider__dot:visible")).toHaveCount(0);
    await expect(page.locator("#s .aero-slider__nav--prev")).toBeDisabled();
    await expect(page.locator("#s .aero-slider__nav--next")).toBeDisabled();
    await page.evaluate(() => window.sliders.s!.next());

    await page.evaluate(() => {
      const make = (label: string) => {
        const slide = document.createElement("div");
        slide.innerHTML = `<div>${label}</div>`;
        return slide;
      };
      document.querySelector("#s .aero-slider__slides")!.append(make("a"), make("b"), make("c"));
      window.sliders.s!.refresh();
    });
    await expect(page.locator("#s .aero-slider__dot:visible")).toHaveCount(3);
    await page.evaluate(() => window.sliders.s!.next());
    await settled(page, "s");
    expect((await state(page, "s")).index).toBe(1);
    expect(errors).toEqual([]);
  });
}
