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
// Called back after layout, so the first read doesn't lay the page out mid-script, and again
// whenever the page's width or height changes.
new ResizeObserver(() => update()).observe(document.documentElement);

// ── Examples menu ──────────────────────────────────────────────────────
// Opens on mouse hover and on keyboard focus. The trigger stays a link to the
// section, so a touch needs one tap to open the menu and a second to follow it.
const menu = document.querySelector<HTMLElement>("[data-menu]");
const trigger = menu?.querySelector<HTMLAnchorElement>("[aria-controls]");
if (menu && trigger) {
  let closeTimer = 0;
  let openAtPress = false;
  let keepClosed = false;
  const isOpen = () => menu.hasAttribute("data-open");
  const setOpen = (open: boolean): void => {
    clearTimeout(closeTimer);
    menu.toggleAttribute("data-open", open);
    trigger.setAttribute("aria-expanded", String(open));
  };

  menu.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") setOpen(true);
  });
  menu.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") closeTimer = window.setTimeout(() => setOpen(false), 150);
  });
  menu.addEventListener("focusin", () => {
    if (keepClosed) keepClosed = false;
    else setOpen(true);
  });
  menu.addEventListener("focusout", (event) => {
    if (!menu.contains(event.relatedTarget as Node | null)) setOpen(false);
  });
  menu.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !isOpen()) return;
    setOpen(false);
    if (document.activeElement !== trigger) {
      keepClosed = true;
      trigger.focus();
    }
  });

  // Focus lands before the click, so the press records whether it was open.
  trigger.addEventListener("pointerdown", () => {
    openAtPress = isOpen();
  });
  menu.addEventListener("click", (event) => {
    const link = (event.target as Element).closest("a");
    if (!link) return;
    const touch = (event as PointerEvent).pointerType === "touch";
    if (link === trigger && touch && !openAtPress) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    setOpen(false);
    link.blur();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!menu.contains(event.target as Node)) setOpen(false);
  });
}
