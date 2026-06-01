// ═══════════════════════════════════════════════════════════════════
// Response Pipeline — shared types & logic for chat consumers
// Aligned with PDF spec v2
// ═══════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────────

export type ResponseMode = "direct" | "clarify_batch" | "source_check" | "handoff";

export type AnswerType =
  | "reproductie"          // factual recall (salary, duration, costs)
  | "wegwijs"              // navigation / link-heavy
  | "verkenning"           // exploration, options side-by-side
  | "intake"               // needs clarification first
  | "begroeting"           // greeting
  | "empathisch_steunend"  // emotional support
  | "bronplichtig"         // requires verified source
  | "handoff_mens";        // hand off to human advisor

export interface FollowUpAction {
  label: string;
  value: string;
}

export interface StructuredResponse {
  mode?: ResponseMode;
  answer_type?: AnswerType;
  directAnswer?: string;
  supportingDetail?: string;
  verifiedLinks?: VerifiedLink[];
  collapse_recommended?: boolean;
  verification_required?: boolean;
  primary_followup?: FollowUpAction | null;
  secondary_action?: FollowUpAction | null;
}

export interface VerifiedLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface IntakeQuestion {
  id: string;
  question: string;
  type: "choice" | "open";
  options?: string[];
}

export interface IntakeBatch {
  questions: IntakeQuestion[];
  context: string;
  summary_template?: string;
}

// ── Answer Type Rules ────────────────────────────────────────────

export const ANSWER_TYPE_RULES: Record<AnswerType, {
  maxSentences: number;
  requiresLink: boolean;
  allowsIntake: boolean;
  requiresVerifiedSource: boolean;
}> = {
  reproductie:         { maxSentences: 4, requiresLink: true,  allowsIntake: false, requiresVerifiedSource: true },
  wegwijs:             { maxSentences: 2, requiresLink: true,  allowsIntake: false, requiresVerifiedSource: false },
  verkenning:          { maxSentences: 5, requiresLink: true,  allowsIntake: true,  requiresVerifiedSource: false },
  intake:              { maxSentences: 2, requiresLink: false, allowsIntake: true,  requiresVerifiedSource: false },
  begroeting:          { maxSentences: 2, requiresLink: false, allowsIntake: false, requiresVerifiedSource: false },
  empathisch_steunend: { maxSentences: 3, requiresLink: false, allowsIntake: false, requiresVerifiedSource: false },
  bronplichtig:        { maxSentences: 4, requiresLink: true,  allowsIntake: false, requiresVerifiedSource: true },
  handoff_mens:        { maxSentences: 2, requiresLink: false, allowsIntake: false, requiresVerifiedSource: false },
};

// ── Internal URL Mapping ─────────────────────────────────────────

export const INTERNAL_URLS: Record<string, string> = {
  opleidingen: "/opleidingen",
  routes: "/opleidingen",
  vacatures: "/vacatures",
  events: "/events",
  evenementen: "/events",
  profiel: "/profiel",
  dashboard: "/dashboard",
  account: "/auth",
  inloggen: "/auth",
  registreren: "/auth",
  kennisbank: "/kennisbank",
  pabo: "/opleidingen",
  "zij-instroom": "/opleidingen",
  zijinstroom: "/opleidingen",
  pdg: "/opleidingen",
  lerarenopleiding: "/opleidingen",
};

export function resolveInternalUrl(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [keyword, url] of Object.entries(INTERNAL_URLS)) {
    if (lower.includes(keyword)) return url;
  }
  return null;
}

// ── Classify Answer Type ─────────────────────────────────────────

const GREETING_RE = /^(hoi|hey|hallo|hi|goedemorgen|goedemiddag|goedenavond|welkom|dag)\b/i;
const FACT_RE = /\b(salaris|verdien|loon|kosten|collegegeld|duur|hoe lang|jaar)\b/i;
const NAV_RE = /\b(waar vind|pagina|bekijk|link|website|url)\b/i;
const HANDOFF_RE = /\b(adviseur|persoonlijk|gesprek|bellen|afspraak|klacht)\b/i;
const EMPATHY_RE = /\b(bang|stress|moeilijk|twijfel|onzeker|verdrietig|frustrer|lastig)\b/i;
const SOURCE_RE = /\b(bron|bewijs|officieel|wet|regeling|cao|ministerie)\b/i;

export function classifyAnswerType(userMessage: string, hasSlotGaps: boolean): AnswerType {
  const trimmed = userMessage.trim();
  if (trimmed.length < 15 && GREETING_RE.test(trimmed)) return "begroeting";
  if (HANDOFF_RE.test(trimmed)) return "handoff_mens";
  if (EMPATHY_RE.test(trimmed)) return "empathisch_steunend";
  if (SOURCE_RE.test(trimmed)) return "bronplichtig";
  if (hasSlotGaps && trimmed.length < 40) return "intake";
  if (NAV_RE.test(trimmed)) return "wegwijs";
  if (FACT_RE.test(trimmed)) return "reproductie";
  return "verkenning";
}

// ── Needs Clarification ──────────────────────────────────────────

interface ClarificationSignals {
  missingSector: boolean;
  missingLevel: boolean;
  backendMode: ResponseMode;
}

export function needsClarification(text: string, signals: ClarificationSignals): boolean {
  if (signals.backendMode === "handoff") return false;
  const isGreeting = /^(hoi|hey|hallo|hi|goedemorgen|goedemiddag|goedenavond|dag)\b/i.test(text.trim());
  if (isGreeting) return false;
  if ((signals.missingSector || signals.missingLevel) && text.length < 80) return true;
  return false;
}

// ── Build Intake Questions (public widget fallback) ──────────────

export function buildIntakeQuestions(signals: { missingSector: boolean; missingLevel: boolean }): IntakeQuestion[] {
  const questions: IntakeQuestion[] = [];

  if (signals.missingSector) {
    questions.push({
      id: "school_type",
      question: "Welke sector spreekt je het meest aan?",
      type: "choice",
      options: ["Basisonderwijs (PO)", "Voortgezet onderwijs (VO)", "MBO", "Speciaal onderwijs", "Weet ik nog niet"],
    });
  }

  if (signals.missingLevel) {
    questions.push({
      id: "admission_requirements",
      question: "Wat is je hoogst afgeronde opleiding?",
      type: "choice",
      options: ["MBO-diploma", "HBO-diploma", "WO-diploma", "Buitenlands diploma", "Anders"],
    });
  }

  return questions.slice(0, 3);
}

// ── Reflect on Draft ─────────────────────────────────────────────
// MIRROR van supabase/functions/_shared/constants.ts → FORBIDDEN_TERMS.
// tsconfig.app.json scope (include: ["src"]) verbiedt directe import uit supabase/,
// dus deze lijst moet handmatig synchroon blijven met de edge-side SSOT.
// De 2 extra termen hieronder ("achtergrondinformatie", "dynamische context") zijn
// frontend-only reflectie-checks; voeg ze NIET toe aan de edge-constants.
const FORBIDDEN_PHRASES = [
  "peildatum",
  "kennisbank",
  "als ai",
  "goed dat je dit vraagt",
  "ik begrijp je helemaal",
  "je moet",
  "scenario",
  "achtergrondinformatie",
  "dynamische context",
  "bekende profieldata",
  // UI-referenties die niet in chat-tekst horen
  "via suggesties",
  "via de suggesties",
  "via het menu",
  "via de chips",
  "kies hieronder",
  "klik hieronder",
  "klik op de",
];

// Regex-based leaks: phase suffix vormen, internal scores, verification dates,
// en interne route-paden die niet in prose horen.
const FORBIDDEN_PATTERNS: RegExp[] = [
  /\b(interesse|ori[eë]ntatie|orienteer|beslis|beslissings?|match|matching|voorbereid(?:ings?)?)[- ]?fase\b/i,
  /\bfase\s*[:=]\s*[a-zA-ZëéèáâüöïíÉ\-]+/i,
  /\(\s*score[:\s]*[\d.,]+\s*\)/i,
  /\bgeverifieerd\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i,
  /\(\s*\/(opleidingen|vacatures|events|kennisbank|profile|dashboard|backoffice|auth)\b[^)]*\)/i,
  /\[\/?(opleidingen|vacatures|events|kennisbank|profile|dashboard|backoffice|auth)\]\(\/(opleidingen|vacatures|events|kennisbank|profile|dashboard|backoffice|auth)/i,
];

export interface ReflectionResult {
  pass: boolean;
  issues: string[];
}

export function reflectOnDraft(
  draft: string,
  question: string,
  answerType: AnswerType,
  verifiedLinks: VerifiedLink[],
): ReflectionResult {
  const issues: string[] = [];
  const lower = draft.toLowerCase();
  const rules = ANSWER_TYPE_RULES[answerType];

  for (const phrase of FORBIDDEN_PHRASES) {
    if (lower.includes(phrase)) {
      issues.push(`Bevat verboden term: "${phrase}"`);
    }
  }
  for (const pattern of FORBIDDEN_PATTERNS) {
    const m = draft.match(pattern);
    if (m) {
      issues.push(`Bevat verboden patroon: "${m[0]}"`);
    }
  }

  const sentences = draft.split(/[.!?]+/).filter((s) => s.trim().length > 5);
  if (sentences.length > rules.maxSentences * 1.5) {
    issues.push(`Te lang: ${sentences.length} zinnen (max ~${rules.maxSentences})`);
  }

  if (/[\u2014\u2013]/.test(draft)) {
    issues.push("Bevat em-dash of en-dash");
  }

  if (rules.requiresVerifiedSource && verifiedLinks.length === 0) {
    issues.push("Bronplichtig antwoord zonder geverifieerde link");
  }

  const questionMarks = draft.split(/[.!]\s/).filter((s) => s.trim().endsWith("?"));
  if (questionMarks.length > 1) {
    issues.push(`Meer dan 1 vervolgvraag (${questionMarks.length})`);
  }

  return { pass: issues.length === 0, issues };
}

// ── Parse Structured Meta from SSE ───────────────────────────────

export function parseStructuredMeta(data: Record<string, unknown>): StructuredResponse | null {
  const meta = (data.meta ?? data) as Record<string, unknown>;
  if (!meta || typeof meta !== "object") return null;

  const result: StructuredResponse = {};
  if (typeof meta.mode === "string") result.mode = meta.mode as ResponseMode;
  if (typeof meta.answer_type === "string") result.answer_type = meta.answer_type as AnswerType;
  if (typeof meta.direct_answer === "string") result.directAnswer = meta.direct_answer;
  if (typeof meta.supporting_detail === "string") result.supportingDetail = meta.supporting_detail;
  if (typeof meta.collapse_recommended === "boolean") result.collapse_recommended = meta.collapse_recommended;
  if (typeof meta.verification_required === "boolean") result.verification_required = meta.verification_required;

  if (meta.primary_followup && typeof meta.primary_followup === "object") {
    const pf = meta.primary_followup as Record<string, string>;
    if (pf.label && pf.value) result.primary_followup = { label: pf.label, value: pf.value };
  }

  if (meta.secondary_action && typeof meta.secondary_action === "object") {
    const sa = meta.secondary_action as Record<string, string>;
    if (sa.label && sa.value) result.secondary_action = { label: sa.label, value: sa.value };
  }

  if (Array.isArray(meta.verified_links)) {
    result.verifiedLinks = meta.verified_links
      .filter((l: unknown): l is Record<string, string> => typeof l === "object" && l !== null && "href" in l)
      .map((l) => ({
        label: l.label || "Meer info",
        href: l.href,
        external: !l.href.startsWith("/"),
      }))
      // Guard: only keep valid links (internal paths or absolute http URLs)
      .filter((l) => l.href.startsWith("/") || /^https?:\/\//i.test(l.href));
  }

  if (
    !result.directAnswer &&
    !result.supportingDetail &&
    !result.verifiedLinks &&
    !result.primary_followup &&
    !result.secondary_action
  ) {
    return null;
  }
  return result;
}
