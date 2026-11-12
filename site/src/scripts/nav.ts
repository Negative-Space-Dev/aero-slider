// Scroll-spy: the current section is the last one whose top has passed under
// the sticky header.
const links = [...document.querySelectorAll<HTMLAnchorElement>("a[data-spy]")];
// Unlinked sections count too, so scrolling past API into Use with clears it.
const targets = [
  ...new Set([
    ...document.querySelectorAll<HTMLElement>("main > section[id]"),
    ...links.map((link) => document.getElementById(link.dataset.spy!)),
  ]),
]
  .filter((el): el is HTMLElement => el !== null)
  .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

function currentIds(): Set<string> {
  const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const ids = new Set<string>();
  let current: HTMLElement | undefined;
  for (const target of targets) {
    if (target.getBoundingClientRect().top <= offset + 1) current = target;
  }
  if (!current) return ids;
  ids.add(current.id);
  const link = links.find((l) => l.dataset.spy === current.id);
  if (link?.dataset.parent) ids.add(link.dataset.parent);
  return ids;
}

let frame = 0;
function update(): void {
  frame = 0;
  const ids = currentIds();
  for (const link of links) {
    if (ids.has(link.dataset.spy!)) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}

window.addEventListener(
  "scroll",
  () => {
    frame ||= requestAnimationFrame(update);
  },
  { passive: true }
);
window.addEventListener("resize", update);
update();
