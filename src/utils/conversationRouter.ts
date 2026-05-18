// ═══════════════════════════════════════════════════════════════════
// Conversation Router — per-turn mode decision + visibility rules
// Keeps one dominant mode per assistant turn to prevent UI stacking
// ═══════════════════════════════════════════════════════════════════

// ── Personal pipeline modes ──────────────────────────────────────

export type PersonalMode = "answer" | "clarify" | "guide" | "phase_transition";

// ── General pipeline modes ───────────────────────────────────────

export type GeneralMode = "internal_answer" | "offer_external_search" | "external_result" | "clarify";

export type ConversationMode = PersonalMode | GeneralMode;

// ── Visibility output ────────────────────────────────────────────

export interface TurnVisibility {
  mode: ConversationMode;
  showActionChip: boolean;
  showLinkChip: boolean;
  showPhaseSuggestion: boolean;
  showReflectionWarning: boolean;
}

// ── Signals from the current turn ────────────────────────────────

export interface PersonalTurnSignals {
  pipeline: "personal";
  hasActions: boolean;
  hasLinks: boolean;
  hasPhaseSuggestion: boolean;
  hasReflectionWarning: boolean;
  /** The backend-returned answer_type or mode hint, if any */
  backendMode?: string;
  /** Whether the assistant content looks like a short clarifying question */
  assistantContentShort: boolean;
}

export interface GeneralTurnSignals {
  pipeline: "general";
  hasActions: boolean;
  hasLinks: boolean;
  /** Whether the response includes external/local results */
  hasExternalResults: boolean;
  /** Whether the backend signalled an external search offer */
  offersExternalSearch: boolean;
  assistantContentShort: boolean;
}

export type TurnSignals = PersonalTurnSignals | GeneralTurnSignals;

// ── Classify personal mode ───────────────────────────────────────

function classifyPersonalMode(s: PersonalTurnSignals): PersonalMode {
  // Phase transition takes full priority
  if (s.hasPhaseSuggestion) return "phase_transition";

  // Backend explicitly said clarify / handoff
  if (s.backendMode === "clarify_batch" || s.backendMode === "handoff") return "clarify";

  // Has actions but no links → guide
  if (s.hasActions && !s.hasLinks) return "guide";

  // Short assistant reply with no actions/links = likely clarification
  if (s.assistantContentShort && !s.hasActions && !s.hasLinks) return "clarify";

  return "answer";
}

// ── Classify general mode ────────────────────────────────────────

function classifyGeneralMode(s: GeneralTurnSignals): GeneralMode {
  if (s.assistantContentShort && !s.hasLinks && !s.hasExternalResults) return "clarify";
  if (s.offersExternalSearch) return "offer_external_search";
  if (s.hasExternalResults) return "external_result";
  return "internal_answer";
}

// ── Visibility rules per mode ────────────────────────────────────

const PERSONAL_RULES: Record<PersonalMode, Omit<TurnVisibility, "mode">> = {
  answer: {
    showActionChip: true,
    showLinkChip: true,
    showPhaseSuggestion: false,
    showReflectionWarning: true,
  },
  clarify: {
    showActionChip: false,
    showLinkChip: false,
    showPhaseSuggestion: false,
    showReflectionWarning: false,
  },
  guide: {
    showActionChip: true,
    showLinkChip: false,
    showPhaseSuggestion: false,
    showReflectionWarning: true,
  },
  phase_transition: {
    showActionChip: false,
    showLinkChip: false,
    showPhaseSuggestion: true,
    showReflectionWarning: false,
  },
};

const GENERAL_RULES: Record<GeneralMode, Omit<TurnVisibility, "mode">> = {
  internal_answer: {
    showActionChip: true,
    showLinkChip: true,
    showPhaseSuggestion: false,
    showReflectionWarning: false,
  },
  offer_external_search: {
    showActionChip: true,   // the offer itself is the action
    showLinkChip: false,
    showPhaseSuggestion: false,
    showReflectionWarning: false,
  },
  external_result: {
    showActionChip: false,
    showLinkChip: true,
    showPhaseSuggestion: false,
    showReflectionWarning: false,
  },
  clarify: {
    showActionChip: false,
    showLinkChip: false,
    showPhaseSuggestion: false,
    showReflectionWarning: false,
  },
};

// ── Main entry point ─────────────────────────────────────────────

export function decideConversationMode(signals: TurnSignals): TurnVisibility {
  if (signals.pipeline === "personal") {
    const mode = classifyPersonalMode(signals);
    return { mode, ...PERSONAL_RULES[mode] };
  }

  const mode = classifyGeneralMode(signals);
  return { mode, ...GENERAL_RULES[mode] };
}
