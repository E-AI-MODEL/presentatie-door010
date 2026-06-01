/**
 * Client-side safety net.
 * Mirrors supabase/functions/_shared/sanitize.ts at a smaller scope —
 * just enough to strip leaks that slipped past the edge function (e.g. when
 * the model echoed internal headers or phase suffix vormen mid-stream).
 *
 * Apply once after the SSE stream completes, before persisting / re-rendering.
 */

const PHASE_SUFFIX_RE =
  /\b(interesse|ori[eë]ntatie|orienteer|beslis|beslissings?|match|matching|voorbereid(?:ings?)?)[- ]?fase\b/giu;
const PHASE_LABEL_RE = /\bfase\s*[:=]\s*[a-zA-ZëéèáâüöïíÉ\-]+/gi;
const SCORE_PAREN_RE = /\s*\(\s*score[:\s]*[\d.,]+\s*\)/gi;
const VERIFICATION_DATE_RE =
  /,?\s*\(?\s*geverifieerd\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}\s*\)?/gi;
const INTERNAL_HEADER_RE = /^#{1,6}\s*BEKENDE\s+\w+.*$/gim;
const FORBIDDEN_BARE = [
  "peildatum",
  "kennisbank",
  "achtergrondinformatie",
  "dynamische context",
  "bekende profieldata",
];

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
const _PATH_GROUP = `(?:${INTERNAL_PATH_SLUGS.join("|")})`;
const PARENTHETICAL_PATH_RE = new RegExp(`\\s*\\(\\s*\\/${_PATH_GROUP}\\b[^)]*\\)`, "gi");
const BARE_PATH_RE = new RegExp(`\\s+\\/${_PATH_GROUP}\\b`, "gi");
const SLUG_LABEL_LINK_RE = new RegExp(
  `\\[\\/?${_PATH_GROUP}\\]\\(\\/${_PATH_GROUP}[^)]*\\)`,
  "gi",
);

export function sanitizeClientText(text: string): string {
  if (!text) return text;
  let out = text;
  out = out.replace(INTERNAL_HEADER_RE, "");
  out = out.replace(VERIFICATION_DATE_RE, "");
  out = out.replace(SCORE_PAREN_RE, "");
  out = out.replace(PHASE_SUFFIX_RE, "richting");
  out = out.replace(PHASE_LABEL_RE, "");
  for (const term of FORBIDDEN_BARE) {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "giu");
    out = out.replace(re, "");
  }
  out = out.replace(/ {2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
  return out;
}
