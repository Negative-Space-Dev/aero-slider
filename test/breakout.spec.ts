import {
  type Page,
  create,
  expect,
  expectNear,
  failOnPageErrors,
  mount,
  settled,
  slider,
  test,
} from "./fixtures";

failOnPageErrors();

// A 1000px breakout slider over a 600px layout column: the track pads 200px each side.
async function breakout(page: Page, alignment: "start" | "center" | "end"): Promise<void> {
  await mount(
    page,
    `<div style="width:1000px">${slider("s", 5, {
      className: "aero-slider--breakout",
      style:
        "width:1000px;--aero-layout-width:600px;--aero-slides-per-view:1.2;--aero-slide-gap:20px",
    })}</div>`
  );
  await create(page, "s", { alignment });
}

async function restingSlide(page: Page, index: number) {
  await page.evaluate((index) => window.sliders.s!.goTo(index), index);
  await settled(page, "s");
  return page.evaluate((index) => {
    const track = document.querySelector<HTMLElement>("#s .aero-slider__track")!;
    const r = track.children[index]!.getBoundingClientRect();
    const tr = track.getBoundingClientRect();
    return {
      left: r.left - tr.left,
      right: tr.right - r.right,
      centre: (r.left + r.right) / 2 - tr.left,
      trackWidth: track.clientWidth,
    };
  }, index);
}

test("the track pads out to the layout column", async ({ page }) => {
  await breakout(page, "start");
  await expect(page.locator("#s .aero-slider__track")).toHaveCSS("padding-left", "200px");
});

test("start alignment rests a slide on the padding's inner edge", async ({ page }) => {
  await breakout(page, "start");
  expectNear((await restingSlide(page, 2)).left, 200);
});

test("center alignment rests a slide in the middle of the track", async ({ page }) => {
  await breakout(page, "center");
  const slide = await restingSlide(page, 1);
  expectNear(slide.centre, slide.trackWidth / 2);
});

test("end alignment rests a slide on the padding's inner edge", async ({ page }) => {
  await breakout(page, "end");
  expectNear((await restingSlide(page, 2)).right, 200);
});
