import {
  create,
  expect,
  expectNear,
  failOnPageErrors,
  mount,
  nextFrame,
  recordEvents,
  settled,
  slider,
  state,
  test,
} from "./fixtures";

failOnPageErrors();

test("a slider created while hidden remembers goTo() and lands there once shown", async ({
  page,
}) => {
  await mount(page, `<div id="wrap" style="display:none">${slider("s", 4)}</div>`);
  await create(page, "s", { loop: true });
  const changes = await recordEvents(page, "s", ["slideChange"]);

  await page.evaluate(() => window.sliders.s!.goTo(2));
  await nextFrame(page);
  await nextFrame(page);
  expect(await state(page, "s")).toEqual({ index: 2, position: 0 });

  await page.evaluate(() => (document.getElementById("wrap")!.style.display = ""));
  await settled(page, "s");
  expect((await state(page, "s")).index).toBe(2);
  const centre = await page.evaluate(() => {
    const track = document.querySelector<HTMLElement>("#s .aero-slider__track")!;
    const before = (track.children.length - 4) / 2;
    const r = track.children[before + 2]!.getBoundingClientRect();
    const tr = track.getBoundingClientRect();
    return { at: (r.left + r.right) / 2 - tr.left, middle: track.clientWidth / 2 };
  });
  expectNear(centre.at, centre.middle);
  expect(await changes()).toEqual(["slideChange2"]);

  await page.evaluate(() => window.sliders.s!.next());
  await settled(page, "s");
  expect((await state(page, "s")).index).toBe(3);
});
