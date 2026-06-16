/**
 * Phase Detector Parser (Zij-instroom)
 * Laadt en valideert de 2 SSOT JSON bestanden:
 * - src/data/phase-detector-rules.json
 * - src/data/phase-detector-questions.json
 *
 * Belangrijk: deze parser is bewust klein en deterministisch.
 */
import rulesRaw from "@/data/phase-detector-rules.json?raw";
import questionsRaw from "@/data/phase-detector-questions.json?raw";

export type SlotKey =
  | "school_type"
  | "role_interest"
  | "credential_goal"
  | "admission_requirements"
  | "duration_info"
  | "costs_info"
  | "salary_info"
  | "region_preference"
  | "next_step";

export type DetectorPhaseCode =
  | "interesse"
  | "orientatie"
  | "beslissing"
  | "matching"
  | "voorbereiding";

export interface ExitCriterion {
  type: "slots_present" | "intent";
  slots?: string[];
  intent?: string;
}

export interface PhaseRules {
  schema_version: string;
  audience?: { label: string; code: string };
  slots: Record<SlotKey, { description?: string }>;
  phases: Array<{
    code: DetectorPhaseCode;
    title: string;
    description: string;
    sort?: number;
    required_slots: SlotKey[];
    optional_slots: SlotKey[];
    exit_criteria?: ExitCriterion[];
    next_phase_default?: DetectorPhaseCode;
  }>;
}

export interface PhaseQuestions {
  schema_version: string;
  generated_at?: string;
  slots: SlotKey[];
  slot_to_questions: Record<
    SlotKey,
    Array<{ question_id: string; question_text: string }>
  >;
  phase_to_questions?: Record<
    DetectorPhaseCode,
    Array<{ question_id: string; reason?: string }>
  >;
  question_catalog?: Record<
    string,
    {
      question_id: string;
      question_text: string;
      phase_code?: DetectorPhaseCode;
      theme?: string;
      subtheme?: string | null;
      fills_slots?: SlotKey[];
    }
  >;
}

let cached: { rules: PhaseRules; questions: PhaseQuestions } | null = null;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[PhaseDetector] ${message}`);
}

export function loadPhaseDetectorConfig(): { rules: PhaseRules; questions: PhaseQuestions } {
  if (cached) return cached;

  const rules = JSON.parse(rulesRaw) as PhaseRules;
  const questions = JSON.parse(questionsRaw) as PhaseQuestions;

  assert(!!rules && typeof rules === "object", "rules JSON ontbreekt of is ongeldig.");
  assert(Array.isArray(rules.phases), "rules.phases ontbreekt.");
  assert(!!rules.slots, "rules.slots ontbreekt.");

  const phaseCodes = new Set(rules.phases.map((p) => p.code));
  (["interesse", "orientatie", "beslissing", "matching", "voorbereiding"] as const).forEach(
    (c) => assert(phaseCodes.has(c), `rules.phases mist fasecode: ${c}`),
  );

  assert(!!questions && typeof questions === "object", "questions JSON ontbreekt of is ongeldig.");
  assert(Array.isArray(questions.slots), "questions.slots ontbreekt.");
  assert(!!questions.slot_to_questions, "questions.slot_to_questions ontbreekt.");

  // Basale dekking: elke slot moet minimaal 1 vraag hebben.
  (questions.slots as SlotKey[]).forEach((slot) => {
    const arr = questions.slot_to_questions[slot];
    assert(Array.isArray(arr) && arr.length > 0, `slot_to_questions heeft geen vragen voor slot: ${slot}`);
  });

  cached = { rules, questions };
  return cached;
}
