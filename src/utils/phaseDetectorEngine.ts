/**
 * Phase Detector Engine (Zij-instroom)
 *
 * Doel:
 * - deterministisch (geen LLM nodig)
 * - kiest phase_current + next_question (SSOT)
 * - stelt maximaal 1 vervolgvraag per beurt (via SSOT mapping)
 * - respecteert exit_criteria uit SSOT voor fase-doorstroom
 */
import { loadPhaseDetectorConfig, DetectorPhaseCode, SlotKey, ExitCriterion } from "./phaseDetectorParser";
import { themeHintForTransition } from "./themeMapper";

export type UiPhaseCode =
  | "interesseren"
  | "orienteren"
  | "beslissen"
  | "matchen"
  | "voorbereiden";

export interface ConversationTurn {
  role: "user" | "assistant" | "advisor";
  text: string;
}

export type KnownSlots = Partial<Record<SlotKey, string>>;

export interface PhaseDetectorOutput {
  audience: string;
  phase_current: DetectorPhaseCode;
  phase_current_ui: UiPhaseCode;
  phase_confidence: number; // 0..1
  evidence: string[];
  known_slots: KnownSlots;
  missing_slots: SlotKey[];
  next_slot_key: SlotKey;
  next_question_id: string;
  next_question: string;
  next_phase_target?: DetectorPhaseCode;
  exit_criteria_met?: boolean;
  phase_suggestion?: {
    from: UiPhaseCode;
    to: UiPhaseCode;
    message: string;
  };
}

const UI_TO_DETECTOR: Record<UiPhaseCode, DetectorPhaseCode> = {
  interesseren: "interesse",
  orienteren: "orientatie",
  beslissen: "beslissing",
  matchen: "matching",
  voorbereiden: "voorbereiding",
};

const DETECTOR_TO_UI: Record<DetectorPhaseCode, UiPhaseCode> = {
  interesse: "interesseren",
  orientatie: "orienteren",
  beslissing: "beslissen",
  matching: "matchen",
  voorbereiding: "voorbereiden",
};

const PHASE_LABELS: Record<UiPhaseCode, string> = {
  interesseren: "Interesseren",
  orienteren: "Oriënteren",
  beslissen: "Beslissen",
  matchen: "Matchen",
  voorbereiden: "Voorbereiden",
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function lastUserText(conversation: ConversationTurn[]) {
  for (let i = conversation.length - 1; i >= 0; i--) {
    if (conversation[i].role === "user") return conversation[i].text || "";
  }
  return "";
}

function normalize(s: string) {
  return (s || "").toLowerCase().trim();
}

function extractSlots(text: string, base: KnownSlots): KnownSlots {
  const t = normalize(text);
  const next: KnownSlots = { ...base };

  // Sector
  if (!next.school_type) {
    if (/\bpo\b|basisonderwijs|primair|pabo|basisschool/.test(t)) next.school_type = "PO";
    else if (/\bvo\b|voortgezet|middelbare|tweedegraads|eerstegraads/.test(t)) next.school_type = "VO";
    else if (/\bmbo\b|beroepsonderwijs|pdg/.test(t)) next.school_type = "MBO";
  }

  // Regio
  if (!next.region_preference) {
    if (/rotterdam|rijnmond|zuid-holland/.test(t)) next.region_preference = "Regio Rotterdam";
  }

  // Thema signalen
  if (!next.salary_info && /(salaris|verdien|inschaling|cao)/.test(t)) next.salary_info = "asked";
  if (!next.costs_info && /(kosten|studiekosten|financiering|subsidie|vergoeding)/.test(t)) next.costs_info = "asked";
  if (!next.duration_info && /(duur|hoe lang|tijd|looptijd|2 jaar|4 jaar)/.test(t)) next.duration_info = "asked";
  if (!next.admission_requirements && /(toelating|eisen|vooropleiding|diploma|geschiktheid)/.test(t)) next.admission_requirements = "asked";

  // Interesse rol
  if (!next.role_interest) {
    if (/(lesgeven|voor de klas|docent|leraar)/.test(t)) next.role_interest = "lesgeven";
    else if (/(begeleiden|mentor|coach|ondersteunen)/.test(t)) next.role_interest = "begeleiding";
    else if (/(vak|expertise|instructeur|praktijk|specialist|vak inzetten)/.test(t)) next.role_interest = "vakexpertise";
  }

  // Next step
  if (!next.next_step) {
    if (/(vacature|solliciteren|baan|scholen zoeken)/.test(t)) next.next_step = "vacatures";
    else if (/(gesprek|intake|contact|bellen|afspraak)/.test(t)) next.next_step = "gesprek";
    else if (/(event|open dag|meeloop|proefles)/.test(t)) next.next_step = "event";
  }

  return next;
}

// ─────────────────────────────────────────────────────────────────────
// Exit Criteria Evaluator — checks SSOT rules for phase completion
// ─────────────────────────────────────────────────────────────────────
function evaluateExitCriteria(
  phase: DetectorPhaseCode,
  known: KnownSlots,
  conversation: ConversationTurn[],
): boolean {
  const { rules } = loadPhaseDetectorConfig();
  const phaseRule = rules.phases.find((p) => p.code === phase);
  if (!phaseRule?.exit_criteria) return false;

  const lastText = normalize(lastUserText(conversation));

  for (const criterion of phaseRule.exit_criteria) {
    if (criterion.type === "slots_present") {
      const requiredSlots = criterion.slots || [];
      const allPresent = requiredSlots.every((s) => !!known[s as SlotKey]);
      if (allPresent) return true;
    }
    if (criterion.type === "intent") {
      const intent = criterion.intent;
      if (intent === "wants_orientation_info" && 
          /(hoe word|hoe kan ik|wat moet ik|welke stappen|route|opleiding|zij-instroom|bevoegdheid)/.test(lastText)) {
        return true;
      }
    }
  }
  return false;
}

function scorePhases(
  currentUi: UiPhaseCode,
  conversation: ConversationTurn[],
  knownSlots: KnownSlots,
): { scores: Record<DetectorPhaseCode, number>; evidence: string[] } {
  const text = normalize(lastUserText(conversation));
  const evidence: string[] = [];

  const base: Record<DetectorPhaseCode, number> = {
    interesse: 1,
    orientatie: 1,
    beslissing: 1,
    matching: 1,
    voorbereiding: 1,
  };

  const currentDetector = UI_TO_DETECTOR[currentUi];

  // Reduced bias: from +1.5 to +0.8 for easier phase transitions
  base[currentDetector] += 0.8;
  evidence.push(`Startpunt: huidige fase is ${currentUi}.`);

  // Check exit criteria for current phase
  const exitMet = evaluateExitCriteria(currentDetector, knownSlots, conversation);
  if (exitMet) {
    const { rules } = loadPhaseDetectorConfig();
    const phaseRule = rules.phases.find((p) => p.code === currentDetector);
    const nextPhase = phaseRule?.next_phase_default;
    if (nextPhase) {
      // Big bonus for next phase when exit criteria are met
      base[nextPhase] += 2.0;
      evidence.push(`Exit-criteria voldaan voor ${currentUi}, boost naar ${DETECTOR_TO_UI[nextPhase]}.`);
    }
  }

  // Keywords die iets zeggen over de stap in de reis
  if (/(vacature|solliciteren|scholen|werkplek|regio|rotterdam)/.test(text)) {
    base.matching += 2.5;
    evidence.push("Signaal: matchen (vacatures of regio).");
  }
  if (/(aanmelden|inschrijven|starten|intake|gesprek plannen|gesprek|vog|contract|eerste dag|voorbereiden)/.test(text)) {
    base.voorbereiding += 2.5;
    evidence.push("Signaal: voorbereiden (start, intake of praktische stappen).");
  }
  if (/(welke route|zij-instroom|pabo|tweedegraads|eerstegraads|pdg|toelating|eisen|diploma)/.test(text)) {
    base.orientatie += 2.0;
    evidence.push("Signaal: oriënteren (routes of eisen).");
  }
  if (/(twijfel|keuze maken|past dit|wel of niet|switch|overstap)/.test(text)) {
    base.beslissing += 1.8;
    evidence.push("Signaal: beslissen (twijfel of keuze).");
  }
  // Intent for moving past interesse
  if (/(hoe word|hoe kan ik|wat moet ik|welke stappen|route|opleiding)/.test(text)) {
    base.orientatie += 1.5;
    evidence.push("Signaal: wil oriënteren (hoe/wat vragen).");
  }

  return { scores: base, evidence };
}

function pickPhase(
  currentUi: UiPhaseCode,
  conversation: ConversationTurn[],
  knownSlots: KnownSlots,
): { phase: DetectorPhaseCode; confidence: number; evidence: string[]; exitCriteriaMet: boolean } {
  const { scores, evidence } = scorePhases(currentUi, conversation, knownSlots);
  const currentDetector = UI_TO_DETECTOR[currentUi];
  const exitMet = evaluateExitCriteria(currentDetector, knownSlots, conversation);

  const ordered = (Object.keys(scores) as DetectorPhaseCode[])
    .map((k) => ({ k, v: scores[k] }))
    .sort((a, b) => b.v - a.v);

  const top = ordered[0];
  const second = ordered[1];

  const diff = top.v - second.v;
  const confidence = clamp01(0.35 + diff / 5);

    // Stability threshold — prevent premature phase changes
  if (confidence < 0.55) {
    evidence.push("Confidence laag, houd huidige fase aan voor stabiliteit.");
    return { phase: currentDetector, confidence, evidence, exitCriteriaMet: exitMet };
  }

  return { phase: top.k, confidence, evidence, exitCriteriaMet: exitMet };
}

function chooseNextSlot(
  phase: DetectorPhaseCode,
  known: KnownSlots,
  previousNextSlot?: SlotKey,
  dismissedSlots?: Set<string>,
): { missing: SlotKey[]; nextSlot: SlotKey } {
  const { rules } = loadPhaseDetectorConfig();
  const phaseRule = rules.phases.find((p) => p.code === phase);

  const required = (phaseRule?.required_slots || []) as SlotKey[];
  const optional = (phaseRule?.optional_slots || []) as SlotKey[];

  const allSlots = [...required, ...optional];
  // Filter out both known slots AND dismissed slots
  const missing = allSlots.filter((s) => !known[s] && !dismissedSlots?.has(s));

  if (missing.length > 0) {
    if (previousNextSlot && missing[0] === previousNextSlot && missing.length > 1) {
      return { missing, nextSlot: missing[1] };
    }
    return { missing, nextSlot: missing[0] };
  }

  return { missing: [], nextSlot: "next_step" };
}

function pickQuestionForSlot(slot: SlotKey): { id: string; text: string } {
  const { questions } = loadPhaseDetectorConfig();
  const qList = questions.slot_to_questions[slot];

  if (qList && qList.length > 0) {
    return { id: qList[0].question_id, text: qList[0].question_text };
  }

  return {
    id: "S00000",
    text: "Waar wil je nu mee beginnen: route, eisen, duur, kosten, salaris of vacatures?",
  };
}

export function runPhaseDetector(args: {
  conversation: ConversationTurn[];
  known_slots?: KnownSlots;
  current_phase_ui?: UiPhaseCode;
  previous_next_slot?: SlotKey;
  dismissed_slots?: Set<string>;
}): PhaseDetectorOutput {
  const { rules } = loadPhaseDetectorConfig();

  const currentUi: UiPhaseCode = args.current_phase_ui || "interesseren";
  const baseKnown = args.known_slots || {};

  const latestText = lastUserText(args.conversation);
  const known = extractSlots(latestText, baseKnown);

  const picked = pickPhase(currentUi, args.conversation, known);

  const nextPhaseTarget =
    rules.phases.find((p) => p.code === picked.phase)?.next_phase_default;

  const slotChoice = chooseNextSlot(picked.phase, known, args.previous_next_slot, args.dismissed_slots);
  const q = pickQuestionForSlot(slotChoice.nextSlot);

  // Count user turns — require at least 4 before suggesting phase transition
  const userTurns = args.conversation.filter(t => t.role === "user").length;
  const MIN_TURNS_FOR_PHASE_SUGGESTION = 4;

  // Build phase suggestion if exit criteria are met and we'd move to a new phase
  let phaseSuggestion: PhaseDetectorOutput["phase_suggestion"] | undefined;
  if (picked.exitCriteriaMet && nextPhaseTarget && userTurns >= MIN_TURNS_FOR_PHASE_SUGGESTION) {
    const nextUi = DETECTOR_TO_UI[nextPhaseTarget];
    if (nextUi && nextUi !== currentUi) {
      phaseSuggestion = {
        from: currentUi,
        to: nextUi,
        message: themeHintForTransition(nextUi, known as Record<string, string>),
      };
    }
  }

  return {
    audience: rules.audience?.label || "Zij-instromer",
    phase_current: picked.phase,
    phase_current_ui: DETECTOR_TO_UI[picked.phase],
    phase_confidence: picked.confidence,
    evidence: picked.evidence,
    known_slots: known,
    missing_slots: slotChoice.missing,
    next_slot_key: slotChoice.nextSlot,
    next_question_id: q.id,
    next_question: q.text,
    next_phase_target: nextPhaseTarget,
    exit_criteria_met: picked.exitCriteriaMet,
    phase_suggestion: phaseSuggestion,
  };
}
