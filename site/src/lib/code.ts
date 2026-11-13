/** Languages the docs highlight. Each must be a bundled Shiki language. */
export type CodeLang = "html" | "css" | "typescript" | "javascript" | "bash";

export interface CodeTab {
  label: string;
  code: string;
  lang: CodeLang;
  /** Stable key for the tab; tabs in the same group switch together by key. Defaults to the label. */
  key?: string;
}

export function tabKey(tab: CodeTab): string {
  return tab.key ?? tab.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
