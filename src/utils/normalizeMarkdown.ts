function stripParenthesizedBareUrls(text: string): string {
  // Remove loose parenthesized URLs, but keep markdown links intact:
  // [label](https://example.nl) must survive.
  return text.replace(/(^|[^\]])\((https?:\/\/[^\s)]+)\)/g, (_match, prefix) => prefix);
}

function linkifyBareUrls(text: string): string {
  return text.replace(
    /(^|[\s(])(https?:\/\/[^\s<)\]]+?)([.,;:!?'")\]]*(?:$|\s))/gm,
    (match, prefix: string, url: string, suffix: string) => {
      if (prefix.endsWith("(") || match.includes("](")) return match;
      return `${prefix}[${url}](${url})${suffix}`;
    },
  );
}

/**
 * Normalizes markdown output from the LLM before rendering.
 * - Replaces em/en dashes with regular dashes
 * - Collapses consecutive blank lines
 * - Joins loose lines into paragraphs
 * - Removes loose parenthesized URLs without breaking markdown links
 * - Linkifies bare URLs
 */
export function normalizeMarkdown(input: string): string {
  const s = (input ?? "").replace(/\r/g, "").replace(/\u2014|\u2013/g, "-");

  const lines = s.split("\n");
  const out: string[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length) {
      out.push(paragraph.join(" ").replace(/\s+/g, " ").trim());
      paragraph = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();

    if (t === "") {
      flush();
      if (out[out.length - 1] !== "") out.push("");
      continue;
    }

    const isList = /^([-*]|\d+\.)\s+/.test(t);
    const isHeading = /^#{1,6}\s+/.test(t);
    const isQuote = /^>\s+/.test(t);

    if (isList || isHeading || isQuote) {
      flush();
      out.push(t);
      continue;
    }

    paragraph.push(t);
  }

  flush();

  let normalized = out.join("\n").replace(/\n{3,}/g, "\n\n");
  normalized = stripParenthesizedBareUrls(normalized);
  normalized = normalized.replace(/ {2,}/g, " ").trim();

  return linkifyBareUrls(normalized);
}
