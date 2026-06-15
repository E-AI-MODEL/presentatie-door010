// Per-turn mode decision + visibility rules.
// This file stays backward-compatible while chat rendering moves to turn artifacts.

export type PersonalMode = "answer" | "clarify" | "guide" | "phase_transition";
export type GeneralMode = "internal_answer" | "offer_external_search" | "external_result" | "clarify";
export type ConversationMode = PersonalMode | GeneralMode;

export interface TurnVisibility {
  mode: ConversationMode;
  showActionChip: boolean;
  showLinkChip: boolean;
  showPhaseSuggestion: boolean;
  showReflectionWarning: boolean;
}

export interface PersonalTurnSignals {
  pipeline: "personal";
  hasActions: boolean;
  hasLinks: boolean;
  hasPhaseSuggestion: boolean;
  hasReflectionWarning: boolean;
  backendMode?: string;
  assistantContentShort: boolean;
}

export interface GeneralTurnSignals {
  pipeline: "general";
  hasActions: boolean;
  hasLinks: boolean;
  hasExternalResults: boolean;
  offersExternalSearch: boolean;
  assistantContentShort: boolean;
}

export type TurnSignals = PersonalTurnSignals | GeneralTurnSignals;

function classifyPersonalMode(s: PersonalTurnSignals): PersonalMode {
  if (s.hasPhaseSuggestion) return "phase_transition";
  if (s.backendMode === "clarify_batch" || s.backendMode === "handoff") return "clarify";
  if (s.hasActions && !s.hasLinks) return "guide";
  if (s.assistantContentShort && !s.hasActions && !s.hasLinks) return "clarify";
  return "answer";
}

function classifyGeneralMode(s: GeneralTurnSignals): GeneralMode {
  if (s.offersExternalSearch) return "offer_external_search";
  if (s.hasExternalResults) return "external_result";
  if (s.assistantContentShort && !s.hasActions && !s.hasLinks && !s.hasExternalResults) return "clarify";
  return "internal_answer";
}

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
    showActionChip: true,
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

export function decideConversationMode(signals: TurnSignals): TurnVisibility {
  if (signals.pipeline === "personal") {
    const mode = classifyPersonalMode(signals);
    return { mode, ...PERSONAL_RULES[mode] };
  }
  const mode = classifyGeneralMode(signals);
  return { mode, ...GENERAL_RULES[mode] };
}
