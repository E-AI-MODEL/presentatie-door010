/**
 * Shared output sanitizer for assistant text.
 * Removes internal jargon, verification dates, internal scores, and unsafe URLs
 * before the text is streamed/saved to the user.
 *
 * Used by: homepage-coach, doorai-chat.
 */

import { FORBIDDEN_TERMS } from "./constants.ts";

// Phase-suffix variants used in internal prompt context.
// These do NOT contain the bare word "fase" only — e.g. "interesse-fase" — so
// the bare-word forbidden filter would miss them.
const PHASE_SUFFIX_RE =
  /\b(interesse|ori[eë]ntatie|oriëntatie|orienteer|beslis|beslissings?|match|matching|voorbereid(?:ings?)?)[- ]?fase\b/giu;

// Generic "Fase: xxx" label injection.
const PHASE_LABEL_RE = /\bfase\s*[:=]\s*[a-zA-ZëéèáâüöïíÉ\-]+/gi;

// Internal scoring artefacts: "(score 0.87)", "(score 87)", "score: 0.9".
const SCORE_PAREN_RE = /\s*\(\s*score[:\s]*[\d.,]+\s*\)/gi;
const SCORE_INLINE_RE = /\bscore[:\s]+[\d.,]+%?/gi;

// "geverifieerd <maand> <jaar>" disclaimer that leaks the internal peildatum.
const VERIFICATION_DATE_RE =
  /,?\s*\(?\s*(?:geverifieerd|laatst gecheckt|mogelijk verouderd,?\s*laatst gecheckt)\s+[^)]*?\d{4}\s*\)?/gi;

// "## BEKENDE PROFIELDATA" or similar internal headers the model may echo.
const INTERNAL_HEADER_RE = /^#{1,6}\s*BEKENDE\s+\w+.*$/gim;

// Firecrawl/markdown artefacts that may pass through when raw markdown is injected.
const TABLE_PIPE_RE = /\|\s*-{3,}\s*\|/g;

// Interne route-paden die NOOIT als zichtbare prose-tekst mogen lekken.
// Linkchips renderen die paden al; in de lopende tekst zijn ze altijd ruis.
const INTERNAL_PATH_SLUGS = [
  "opleidingen",
  "vacatures",
  "events",
  "kennisbank",
  "profile",
  "dashboard",
  "backoffice",
  "auth",
];
const INTERNAL_PATH_GROUP = `(?:${INTERNAL_PATH_SLUGS.join("|")})`;
// "(/opleidingen)" of "( /opleidingen?x=1 )" → leeg
const PARENTHETICAL_PATH_RE = new RegExp(
  `\\s*\\(\\s*\\/${INTERNAL_PATH_GROUP}\\b[^)]*\\)`,
  "gi",
);
// "op /opleidingen", " via /vacatures" → strip pad (laat voorzetsel staan)
const BARE_PATH_RE = new RegExp(`\\s+\\/${INTERNAL_PATH_GROUP}\\b`, "gi");
// [/opleidingen](/opleidingen) of [opleidingen](/opleidingen) → leeg
// Behoud beschrijvende anchors zoals [Routes bekijken](/opleidingen).
const SLUG_LABEL_LINK_RE = new RegExp(
  `\\[\\/?${INTERNAL_PATH_GROUP}\\]\\(\\/${INTERNAL_PATH_GROUP}[^)]*\\)`,
  "gi",
);

function stripPhraseCaseInsensitive(text: string, phrase: string): string {
  if (!phrase) return text;
  // Escape regex specials, then match as a whole word where possible.
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // For multi-word phrases, allow flexible whitespace.
  const pattern = escaped.replace(/\s+/g, "\\s+");
  // Use word boundaries when the phrase starts/ends with a word char.
  const startsAlnum = /^[\p{L}\p{N}]/u.test(phrase);
  const endsAlnum = /[\p{L}\p{N}]$/u.test(phrase);
  const left = startsAlnum ? "\\b" : "";
  const right = endsAlnum ? "\\b" : "";
  const re = new RegExp(`${left}${pattern}${right}`, "giu");
  return text.replace(re, "");
}

const MARKDOWN_LINK_RE_FT = /\[([^\]]+)\]\(([^)]+)\)/g;

function transformOutsideMarkdownLinks(text: string, fn: (s: string) => string): string {
  let out = "";
  let lastIndex = 0;
  const re = new RegExp(MARKDOWN_LINK_RE_FT.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out += fn(text.slice(lastIndex, m.index));
    out += m[0];
    lastIndex = m.index + m[0].length;
  }
  out += fn(text.slice(lastIndex));
  return out;
}

export function stripForbiddenTerms(text: string): string {
  let out = text;
  // Suffix-vormen eerst (langer = specifieker), zodat we niet eerst "fase" weghalen.
  out = out.replace(PHASE_SUFFIX_RE, "richting");
  out = out.replace(PHASE_LABEL_RE, "");
  // Forbidden terms alleen buiten markdown-link-labels strippen.
  out = transformOutsideMarkdownLinks(out, (segment) => {
    let s = segment;
    for (const term of FORBIDDEN_TERMS) {
      s = stripPhraseCaseInsensitive(s, term);
    }
    return s;
  });
  return out;
}

export function stripVerificationDates(text: string): string {
  return text.replace(VERIFICATION_DATE_RE, "");
}

export function stripInternalScores(text: string): string {
  return text.replace(SCORE_PAREN_RE, "").replace(SCORE_INLINE_RE, "");
}

export function stripInternalHeaders(text: string): string {
  return text.replace(INTERNAL_HEADER_RE, "").replace(TABLE_PIPE_RE, "");
}

/**
 * URL sanitizer — remove external URLs and bare domains that are not in the
 * whitelist. Markdown links to whitelisted domains stay intact.
 * Lifted from homepage-coach so doorai-chat can use the same logic.
 */
export function stripInternalPaths(text: string): string {
  let out = text;
  out = out.replace(SLUG_LABEL_LINK_RE, "");
  out = out.replace(PARENTHETICAL_PATH_RE, "");
  out = out.replace(BARE_PATH_RE, "");
  return out;
}

function hostFromUrl(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function stripParenthesizedBareUrls(text: string): string {
  // Remove loose parenthesized URLs, but keep markdown links intact.
  return text.replace(/(^|[^\]])\((https?:\/\/[^\s)]+)\)/g, (_match, prefix) => prefix);
}

/**
 * URL sanitizer — remove external URLs and bare domains that are not in the
 * whitelist. Markdown links to whitelisted domains stay intact.
 */
export function sanitizeUrls(text: string, whitelistedDomains: Set<string>): string {
  let result = text;

  // Markdown links must be handled before parenthesized URL cleanup.
  result = result.replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, url) => {
    const hostname = hostFromUrl(url);
    if (hostname && whitelistedDomains.has(hostname)) return `[${label}](${url})`;
    return label;
  });

  result = stripParenthesizedBareUrls(result);

  result = result.replace(/(^|[\s(])(https?:\/\/[^\s<)\]]+)/gm, (match, prefix, url) => {
    const hostname = hostFromUrl(url);
    if (hostname && whitelistedDomains.has(hostname)) return match;
    return prefix;
  });

  result = result.replace(/(^|[\s(])([a-z0-9-]+\.[a-z]{2,}(?:\/[^\s]*)?)/gim, (match, prefix, domain) => {
    if (domain.startsWith("/")) return match;
    const hostname = domain.split("/")[0].replace(/^www\./, "");
    if (whitelistedDomains.has(hostname)) return match;
    return prefix;
  });

  // Common cleanup after removals.
  result = result.replace(/\(\s*\)/g, "").replace(/\s+,/g, ",").replace(/ {2,}/g, " ").trim();
  return result;
}

/**
 * Full sanitize pipeline. Apply to any assistant text just before it leaves
 * the edge function (streaming finalization or non-streaming response).
 */
export function sanitizeAssistantText(
  text: string,
  opts?: { whitelistedDomains?: Set<string> },
): string {
  let out = text;
  out = stripInternalHeaders(out);
  out = stripVerificationDates(out);
  out = stripInternalScores(out);
  out = stripForbiddenTerms(out);
  out = stripInternalPaths(out);
  if (opts?.whitelistedDomains) out = sanitizeUrls(out, opts.whitelistedDomains);
  // Clean up double spaces / dangling punctuation left by removals.
  out = out.replace(/ {2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
  return out;
}
