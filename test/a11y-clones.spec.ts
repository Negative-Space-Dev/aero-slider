import { type Page, create, expect, mount, slider, test } from "./fixtures";

const content = [
  `<details><summary>more</summary>text</details>`,
  `<iframe srcdoc="" title="frame"></iframe>`,
  `<audio controls></audio>`,
  `<video controls></video>`,
  `<div contenteditable>edit</div>`,
  `<img usemap="#m" alt="" width="10" height="10"><map name="m"><area href="#a" shape="rect" coords="0,0,10,10" alt="area"></map>`,
  `<embed type="text/html" width="10" height="10">`,
  `<object type="text/html" width="10" height="10"></object>`,
];

/** Tab presses from #before until #after, failing if focus ever lands inside a clone. */
async function tabStops(page: Page): Promise<number> {
  await page.locator("#before").focus();
  for (let presses = 1; presses <= 60; presses++) {
    await page.keyboard.press("Tab");
    const at = await page.evaluate(() => {
      const el = document.activeElement!;
      return el.closest("[data-aero-slider-clone]") ? "clone" : el.id;
    });
    expect(at, `Tab ${presses}`).not.toBe("clone");
    if (at === "after") return presses;
  }
  throw new Error("never reached #after");
}

test("focusable content in loop clones stays out of the tab order", async ({ page }) => {
  const markup = `<button id="before">before</button>${slider("s", content.length, {
    inner: (i) => `<div>${content[i]}</div>`,
    nav: false,
    dots: false,
  })}<button id="after">after</button>`;
  await mount(page, markup);
  await create(page, "s");
  const plain = await tabStops(page);
  await mount(page, markup);
  await create(page, "s", { loop: true });
  await expect(page.locator("#s [data-aero-slider-clone]")).not.toHaveCount(0);
  expect(await tabStops(page)).toBe(plain);
});

test("loop clones don't join forms or labels, and still autoplay like their slide", async ({
  page,
}) => {
  const fields = [
    `<label for="email">Email</label><input id="email" name="email" value="a@b.c">`,
    `<input type="radio" name="size" value="s"><input type="radio" name="size" value="m" checked>`,
    `<video autoplay muted></video>`,
  ];
  await mount(
    page,
    `<form id="f">${slider("s", fields.length, {
      inner: (i) => `<div>${fields[i]}</div>`,
      nav: false,
      dots: false,
    })}</form>`
  );
  await create(page, "s", { loop: true });
  await expect(page.locator("#s [data-aero-slider-clone]")).not.toHaveCount(0);
  const form = await page.evaluate(() => {
    const data = new FormData(document.getElementById("f") as HTMLFormElement);
    return { email: data.getAll("email"), size: data.getAll("size") };
  });
  expect(form).toEqual({ email: ["a@b.c"], size: ["m"] });
  await expect(page.locator("#email")).toHaveAccessibleName("Email");
  await expect(page.locator("#s [data-aero-slider-clone] video[autoplay]")).not.toHaveCount(0);
  await expect(
    page.locator("#s [data-aero-slider-clone] [name], #s [data-aero-slider-clone] [for]")
  ).toHaveCount(0);
});

// Without its name a cloned radio is a group of its own that nothing ever checks, and a cloned
// text field is never filled in. Left required, either would stop the form from submitting.
test("required controls in loop clones don't block the form", async ({ page }) => {
  const fields = (i: number) =>
    `<label><input type="radio" name="size" value="${i}" required>${i}</label><input type="text" name="note${i}" required>`;
  await mount(page, `<form id="f">${slider("s", 3, { inner: fields })}</form>`);
  await create(page, "s", { loop: true });
  expect(await page.locator("#s [data-aero-slider-clone] input").count()).toBeGreaterThan(0);
  const valid = await page.evaluate(() => {
    const real = (selector: string) => [
      ...document.querySelectorAll<HTMLInputElement>(`#s [data-aero-slider-index] ${selector}`),
    ];
    real("[type=radio]")[0]!.checked = true;
    for (const field of real("[type=text]")) field.value = "x";
    return (document.getElementById("f") as HTMLFormElement).checkValidity();
  });
  expect(valid).toBe(true);
});
