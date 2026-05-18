/**
 * Normalizes markdown output from the LLM before rendering.
 * - Replaces em-dashes with regular dashes
 * - Collapses consecutive blank lines
 * - Joins loose lines (non-bullet, non-heading, non-quote) into paragraphs
 * - Cleans up parenthesized URLs and bare domains
 */
export function normalizeMarkdown(input: string): string {
  const s = (input ?? "").replace(/\r/g, "").replace(/\u2014/g, "-");

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

  // Remove parenthesized URLs like (https://www.example.nl/path)
  normalized = normalized.replace(/\(https?:\/\/[^\s)]+\)/g, "");

  // Clean up double spaces left by URL removal
  normalized = normalized.replace(/ {2,}/g, " ");

  // Linkify bare URLs so they become clickable in markdown rendering.
  // Strip trailing punctuation from URLs to avoid broken links.
  return normalized.replace(
    /(^|[\s(])(https?:\/\/[^\s<)\]]+?)([.,;:!?'")\]]*(?:$|\s))/gm,
    (match, prefix: string, url: string, suffix: string) => {
      // Skip already-markdown-linked URLs.
      if (match.includes("](")) return match;
      return `${prefix}[${url}](${url})${suffix}`;
    },
  );
}
