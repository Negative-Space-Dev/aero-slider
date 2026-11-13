function selectTab(block: HTMLElement, key: string): void {
  const tabs = block.querySelectorAll<HTMLButtonElement>("[data-tab]");
  if (![...tabs].some((tab) => tab.dataset.tab === key)) return;
  for (const tab of tabs) {
    const active = tab.dataset.tab === key;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  for (const panel of block.querySelectorAll<HTMLElement>("[data-panel]")) {
    panel.hidden = panel.dataset.panel !== key;
  }
}

function activate(block: HTMLElement, key: string): void {
  const group = block.dataset.tabGroup;
  const blocks = group
    ? document.querySelectorAll<HTMLElement>(`[data-code-tabs][data-tab-group="${group}"]`)
    : [block];
  for (const each of blocks) selectTab(each, key);
}

async function copy(block: HTMLElement, button: HTMLButtonElement): Promise<void> {
  const panel = block.querySelector<HTMLElement>("[data-panel]:not([hidden])");
  const code = panel?.querySelector("code")?.textContent ?? "";
  await navigator.clipboard.writeText(code);
  const label = button.querySelector("[data-copy-label]");
  const [copyIcon, doneIcon] = button.querySelectorAll("svg");
  if (label) label.textContent = "Copied";
  copyIcon?.setAttribute("hidden", "");
  doneIcon?.removeAttribute("hidden");
  setTimeout(() => {
    if (label) label.textContent = "Copy";
    doneIcon?.setAttribute("hidden", "");
    copyIcon?.removeAttribute("hidden");
  }, 1600);
}

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const block = target.closest<HTMLElement>("[data-code-tabs]");
  if (!block) return;
  const tab = target.closest<HTMLButtonElement>("[data-tab]");
  if (tab?.dataset.tab) activate(block, tab.dataset.tab);
  const copyButton = target.closest<HTMLButtonElement>("[data-copy]");
  if (copyButton) void copy(block, copyButton);
});

document.addEventListener("keydown", (event) => {
  const tab = (event.target as HTMLElement).closest<HTMLButtonElement>("[role=tab][data-tab]");
  if (!tab || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
  const block = tab.closest<HTMLElement>("[data-code-tabs]");
  if (!block) return;
  const tabs = [...block.querySelectorAll<HTMLButtonElement>("[data-tab]")];
  const step = event.key === "ArrowRight" ? 1 : -1;
  const next = tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length];
  event.preventDefault();
  activate(block, next.dataset.tab!);
  next.focus();
});
