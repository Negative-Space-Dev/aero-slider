import {
  create,
  expect,
  failOnPageErrors,
  mount,
  nextFrame,
  recordEvents,
  slider,
  test,
} from "./fixtures";

failOnPageErrors();

test("a nested slider's slideChange doesn't restart the outer slider's autoplay", async ({
  page,
}) => {
  await mount(
    page,
    slider("outer", 3, { inner: (i) => (i === 0 ? slider("inner", 3) : `<div>${i}</div>`) })
  );
  await create(page, "outer", { loop: true, autoplay: true, autoplayInterval: 400 });
  await create(page, "inner", { loop: true, autoplay: true, autoplayInterval: 150 });
  const outer = await recordEvents(page, "outer", ["slideChange"]);
  const inner = await recordEvents(page, "inner", ["slideChange"]);

  await expect.poll(async () => (await outer()).length, { timeout: 5000 }).toBeGreaterThan(0);
  expect((await inner()).length).toBeGreaterThan(1);
});

// Once the outer slider captures the pointer for a sideways drag, the inner one must not start its
// own drag on the same pointer.
test("a vertical slider inside a horizontal one leaves a pointer the outer one captured", async ({
  page,
}) => {
  await mount(
    page,
    slider("outer", 3, {
      inner: (i) => (i === 0 ? slider("inner", 3, { style: "height:300px" }) : `<div>${i}</div>`),
    })
  );
  await create(page, "inner", { vertical: true });
  await create(page, "outer");
  const box = (await page.locator("#inner .aero-slider__track").boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await nextFrame(page);
  await page.mouse.move(x - 70, y);
  await nextFrame(page);
  await page.mouse.move(x - 130, y - 90);
  await nextFrame(page);

  await expect(page.locator("#outer")).toHaveClass(/aero-slider--dragging/);
  await expect(page.locator("#inner")).not.toHaveClass(/aero-slider--dragging/);
  expect(await page.locator("#inner .aero-slider__track").evaluate((t) => t.scrollTop)).toBe(0);
  await page.mouse.up();
});
