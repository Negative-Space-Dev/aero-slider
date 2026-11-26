import {
  type Page,
  create,
  expect,
  failOnPageErrors,
  mount,
  slider,
  state,
  test,
} from "./fixtures";

failOnPageErrors();

// iOS picks a swipe's snap target as the finger lifts. A touch that stops the track after that
// leaves it between slides, and WebKit hides that touch from the page. No engine here can do the
// same, so native snapping is turned off and the track is stopped by hand.
async function stoppable(page: Page, loop: boolean, scrollend: boolean): Promise<void> {
  await mount(page, slider("s", 6, { style: "--aero-slide-gap:10px" }), {
    head: "<style>.aero-slider__track{scroll-snap-type:none!important}</style>",
  });
  await create(page, "s", { loop });
  if (!scrollend) {
    await page.evaluate(() =>
      document
        .getElementById("s")!
        .addEventListener("scrollend", (e) => e.stopPropagation(), { capture: true })
    );
  }
}

const scrollBy = (page: Page, distance: number) =>
  page.evaluate((d) => {
    const track = document.querySelector("#s .aero-slider__track")!;
    track.scrollTo({ left: track.scrollLeft + d, behavior: "instant" });
  }, distance);

/** How far the track is from the nearest child's snap position, with every slide 610px apart. */
const offSlide = async (page: Page) => {
  const { position } = await state(page, "s");
  const rest = ((position % 610) + 610) % 610;
  return Math.round(Math.min(rest, 610 - rest));
};

for (const loop of [false, true]) {
  const name = loop ? "loop" : "no loop";

  test(`a scroll stopped between slides, with no scrollend, rests on a slide: ${name}`, async ({
    page,
  }) => {
    await stoppable(page, loop, false);
    await scrollBy(page, 400);
    await expect.poll(() => offSlide(page)).toBe(0);
    expect((await state(page, "s")).index).toBe(1);
  });

  for (const scrollend of [true, false]) {
    test(`a move stopped short by an unseen touch rests on a slide: ${name}, scrollend ${scrollend}`, async ({
      page,
    }) => {
      await stoppable(page, loop, scrollend);
      const start = (await state(page, "s")).position;
      await page.evaluate(async () => {
        const track = document.querySelector("#s .aero-slider__track")!;
        const from = track.scrollLeft;
        window.sliders.s!.goTo(2);
        while (Math.abs(track.scrollLeft - from) < 60) await new Promise(requestAnimationFrame);
        track.scrollTo({ left: from + 200, behavior: "instant" });
      });
      await expect.poll(() => offSlide(page)).toBe(0);
      await page.waitForTimeout(400);
      const end = await state(page, "s");
      expect(end.index).toBe(0);
      expect(Math.abs(end.position - start)).toBeLessThan(2);
    });
  }
}

// Where a scrollend should come, the settle that stands in for a missing one waits long enough
// that a native glide pausing in its last pixels isn't eased onto its slide from under it.
test("a track that pauses short of a slide, where a scrollend should come, is left to finish", async ({
  page,
}) => {
  await stoppable(page, false, false);
  await scrollBy(page, 400);
  await page.waitForTimeout(350);
  expect((await state(page, "s")).position).toBe(400);
  await expect.poll(() => state(page, "s")).toEqual({ index: 1, position: 610 });
});

test("a track stopped short of a slide, where there's no scrollend, settles soon", async ({
  page,
}) => {
  await stoppable(page, false, false);
  const supported = await page.evaluate(() => {
    const track = document.querySelector("#s .aero-slider__track")!;
    for (let o = track; o; o = Object.getPrototypeOf(o))
      delete (o as Partial<HTMLElement>).onscrollend;
    return "onscrollend" in track;
  });
  expect(supported).toBe(false);
  await scrollBy(page, 400);
  await page.waitForTimeout(350);
  expect((await state(page, "s")).position).not.toBe(400);
  await expect.poll(() => state(page, "s")).toEqual({ index: 1, position: 610 });
});

test("a press on a track stopped between slides waits for its release, then rests on a slide", async ({
  page,
}) => {
  await stoppable(page, false, false);
  const box = (await page.locator("#s .aero-slider__track").boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + 60);
  await scrollBy(page, 400);
  await page.mouse.down();
  await page.waitForTimeout(500);
  expect((await state(page, "s")).position).toBe(400);
  await page.mouse.up();
  await expect.poll(() => state(page, "s")).toEqual({ index: 1, position: 610 });
});

// The settle still owed to the scroll must not take a goTo() that has only just started for one
// that was stopped. Where in a frame the two meet varies, so try a spread of delays.
test("a goTo() as a settle comes due still reaches its slide", async ({ page }) => {
  await stoppable(page, false, false);
  for (const delay of [460, 470, 480, 485, 490, 495, 500, 505, 510]) {
    await page.evaluate(async (delay) => {
      const track = document.querySelector("#s .aero-slider__track")!;
      window.sliders.s!.goTo(0, { instant: true });
      await new Promise((resolve) => setTimeout(resolve, 500));
      track.scrollTo({ left: 100, behavior: "instant" });
      await new Promise((resolve) => track.addEventListener("scroll", resolve, { once: true }));
      await new Promise((resolve) => setTimeout(resolve, delay));
      window.sliders.s!.goTo(3);
    }, delay);
    await page.waitForTimeout(1500);
    expect(await state(page, "s"), `${delay}ms`).toEqual({ index: 3, position: 1830 });
  }
});

test("a goTo() on a page too busy to deliver its scroll events still reaches its slide", async ({
  page,
}) => {
  await stoppable(page, false, false);
  await page.evaluate(async () => {
    const track = document.querySelector("#s .aero-slider__track")!;
    window.sliders.s!.goTo(4);
    while (track.scrollLeft < 60) await new Promise(requestAnimationFrame);
    const until = performance.now() + 650;
    while (performance.now() < until);
  });
  await expect.poll(() => state(page, "s")).toEqual({ index: 4, position: 2440 });
  await page.waitForTimeout(400);
  expect(await state(page, "s")).toEqual({ index: 4, position: 2440 });
});

test("a scrollend settles a swipe that began before the last one had settled", async ({ page }) => {
  await stoppable(page, true, true);
  const box = (await page.locator("#s .aero-slider__track").boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + 60);
  // A press while the track moves, then a scroll that carries on past its release.
  const waited = await page.evaluate(async () => {
    const track = document.querySelector<HTMLElement>("#s .aero-slider__track")!;
    const press = (type: string) =>
      track.dispatchEvent(
        new PointerEvent(type, { bubbles: true, pointerId: 9, pointerType: "pen", button: 2 })
      );
    track.addEventListener("scrollend", (e) => e.isTrusted && e.stopPropagation(), {
      capture: true,
    });
    const scrolled = () =>
      new Promise((resolve) => track.addEventListener("scroll", resolve, { once: true }));
    let next = scrolled();
    track.scrollTo({ left: track.scrollLeft + 100, behavior: "instant" });
    await next;
    press("pointerdown");
    press("pointerup");
    next = scrolled();
    track.scrollTo({ left: 610 * 12, behavior: "instant" }); // the clone of slide 0
    await next;
    track.dispatchEvent(new Event("scrollend"));
    return track.scrollLeft;
  });
  expect(waited).toBe(610 * 6);
});
