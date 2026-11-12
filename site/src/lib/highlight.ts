// A small highlighter for the playground's generated code. It emits the same
// markup and --astro-code-* colours as Shiki's css-variables theme, so live
// code matches the build-time blocks without shipping Shiki to the browser.

export type LiveLang = "html" | "css" | "js";

type Token = [color: string | null, text: string];

// Sticky patterns, tried in order at the current position of the line.
const RULES: Record<LiveLang, [RegExp, string | null][]> = {
  html: [
    [/<!--.*?-->/y, "comment"],
    [/<\/?/y, null],
    [/(?<=<\/?)[\w-]+/y, "string-expression"],
    [/\s+[\w-]+(?==)/y, "function"],
    [/=/y, "keyword"],
    [/"[^"]*"/y, "string-expression"],
    [/\/?>/y, null],
    [/[^<]+/y, null],
  ],
  css: [
    [/\/\*.*?\*\//y, "comment"],
    [/[#.][\w-]+(?=\s*\{)/y, "function"],
    [/\s*--[\w-]+(?=:)/y, null],
    [/\s*[\w-]+(?=:)/y, "constant"],
    [/:/y, "keyword"],
    [/\s*-?[\d.]+/y, "constant"],
    [/(px|rem|em|%|vw|vh)\b/y, "keyword"],
    [/\s*\//y, "keyword"],
    [/[\s{};]+/y, null],
    [/\s*[\w-]+/y, "constant"],
  ],
  js: [
    [/\/\/.*/y, "comment"],
    [/"[^"]*"/y, "string-expression"],
    [/\b(import|from|const|let|new|return)\b/y, "keyword"],
    [/\b(true|false|null|undefined|document)\b/y, "constant"],
    [/(?<=\b(const|let)\s+)\w+/y, "constant"],
    [/\.?\w+(?=\()/y, "function"],
    [/-?\d[\d.]*/y, "constant"],
    [/[:=]/y, "keyword"],
    [/,/y, "punctuation"],
    [/\s+|\w+|\.|[^\s"\w.,:=]+/y, null],
  ],
};

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tokenizeLine(line: string, lang: LiveLang): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  while (at < line.length) {
    let token: Token = [null, line[at]];
    for (const [pattern, color] of RULES[lang]) {
      pattern.lastIndex = at;
      const match = pattern.exec(line);
      if (match?.[0]) {
        token = [color, match[0]];
        break;
      }
    }
    tokens.push(token);
    at += token[1].length;
  }
  return tokens;
}

function span([color, text]: Token): string {
  const variable = color ? `--astro-code-token-${color}` : "--astro-code-foreground";
  return `<span style="color:var(${variable})">${escape(text)}</span>`;
}

/** Highlighted `<pre>` markup in the shape Astro's <Code> renders. */
export function highlight(code: string, lang: LiveLang): string {
  const lines = code
    .split("\n")
    .map((line) => `<span class="line">${tokenizeLine(line, lang).map(span).join("")}</span>`)
    .join("\n");
  return `<pre class="astro-code css-variables" style="background-color:var(--astro-code-background);color:var(--astro-code-foreground); overflow-x: auto;" tabindex="0" data-language="${lang}"><code>${lines}</code></pre>`;
}
