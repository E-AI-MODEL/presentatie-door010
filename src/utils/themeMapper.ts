/**
 * Theme Mapper — shared utility that derives compact, UI-safe conversation themes
 * from phase + known/missing slots + SSOT signals.
 *
 * Used by: TopicMenu, phaseDetectorEngine, responsePipeline, PublicChatWidget
 * NOT used by edge functions (they inline similar logic).
 */

export interface ThemeSignal {
  key: string;
  label: string;
  chatPrompt: string;
}

const ALL_THEMES: ThemeSignal[] = [
  { key: "route", label: "Routes en opleidingen", chatPrompt: "Welke routes zijn er om in het onderwijs te werken?" },
  { key: "bevoegdheid", label: "Bevoegdheden", chatPrompt: "Welke bevoegdheid heb ik nodig?" },
  { key: "vacatures", label: "Vacatures", chatPrompt: "Welke vacatures zijn er in het onderwijs?" },
  { key: "salaris", label: "Salaris en arbeidsvoorwaarden", chatPrompt: "Wat verdient een leraar?" },
  { key: "kosten", label: "Kosten en financiering", chatPrompt: "Wat kost een opleiding en welke financiering is er?" },
  { key: "subsidie", label: "Subsidies en tegemoetkomingen", chatPrompt: "Welke subsidies zijn er voor aanstaande leraren?" },
  { key: "regio", label: "Regio en scholen", chatPrompt: "Welke scholen en mogelijkheden zijn er in mijn regio?" },
  { key: "toelating", label: "Toelatingseisen", chatPrompt: "Wat zijn de toelatingseisen?" },
  { key: "functie", label: "Functies in het onderwijs", chatPrompt: "Welke functies zijn er in het onderwijs?" },
  { key: "sector", label: "Sectoren vergelijken", chatPrompt: "Wat zijn de verschillen tussen PO, VO en MBO?" },
  { key: "next_step", label: "Volgende stap", chatPrompt: "Wat is mijn logische volgende stap?" },
  { key: "events", label: "Events en open dagen", chatPrompt: "Zijn er events of open dagen?" },
  { key: "zij_instroom", label: "Zij-instroom", chatPrompt: "Hoe werkt zij-instroom precies?" },
];

export function deriveThemes(opts: {
  phase: string;
  knownSlots: Record<string, string>;
  missingSlots?: string[];
  maxThemes?: number;
}): ThemeSignal[] {
  const { phase, knownSlots, missingSlots = [], maxThemes = 4 } = opts;
  const p = phase.toLowerCase();
  const selected: ThemeSignal[] = [];
  const used = new Set<string>();

  function add(key: string) {
    if (used.has(key)) return;
    const t = ALL_THEMES.find(th => th.key === key);
    if (t) { selected.push(t); used.add(key); }
  }

  // Phase-driven priorities
  if (p === "interesseren") {
    if (!knownSlots.school_type) add("sector");
    if (!knownSlots.role_interest) add("functie");
    add("route");
    add("salaris");
  } else if (p === "orienteren") {
    add("route");
    add("bevoegdheid");
    add("toelating");
    add("kosten");
  } else if (p === "beslissen") {
    add("kosten");
    add("subsidie");
    add("salaris");
    add("zij_instroom");
  } else if (p === "matchen") {
    add("vacatures");
    add("regio");
    add("events");
  } else if (p === "voorbereiden") {
    add("next_step");
    add("events");
    add("regio");
  }

  // Slot-driven additions
  if (knownSlots.region_preference && !used.has("regio")) add("regio");
  if (missingSlots.includes("admission_requirements") && !used.has("toelating")) add("toelating");
  if ((missingSlots.includes("salary_info") || knownSlots.salary_info) && !used.has("salaris")) add("salaris");
  if ((missingSlots.includes("costs_info") || knownSlots.costs_info) && !used.has("kosten")) add("kosten");
  if (knownSlots.role_interest && !used.has("functie")) add("functie");

  return selected.slice(0, maxThemes);
}

/**
 * Pick a short, human-readable hint for a phase transition suggestion.
 * Uses the TARGET phase themes (what's coming next).
 */
export function themeHintForTransition(
  targetPhase: string,
  knownSlots: Record<string, string>,
): string {
  const themes = deriveThemes({ phase: targetPhase, knownSlots, maxThemes: 2 });
  if (themes.length === 0) return "Zullen we verder kijken?";
  const labels = themes.map(t => t.label.toLowerCase());
  if (labels.length === 1) return `Wil je meer weten over ${labels[0]}?`;
  return `Wil je meer weten over ${labels[0]} of ${labels[1]}?`;
}

/**
 * Get theme signals suitable for public/anonymous widget context.
 * Lighter than the full deriveThemes — no slot awareness.
 */
export function publicThemes(userMessage: string): ThemeSignal[] {
  const msg = userMessage.toLowerCase();
  const selected: ThemeSignal[] = [];
  const used = new Set<string>();

  function add(key: string) {
    if (used.has(key)) return;
    const t = ALL_THEMES.find(th => th.key === key);
    if (t) { selected.push(t); used.add(key); }
  }

  if (/(route|opleiding|zij-instroom|hoe word|leraar word)/.test(msg)) add("route");
  if (/(vacature|baan|werk|school)/.test(msg)) add("vacatures");
  if (/(salaris|verdien|loon|cao)/.test(msg)) add("salaris");
  if (/(kosten|collegegeld|subsidie|financier|gratis)/.test(msg)) add("kosten");
  if (/(bevoegdheid|eerste|tweede|graads)/.test(msg)) add("bevoegdheid");
  if (/(event|open dag|meeloop)/.test(msg)) add("events");
  if (/(regio|rotterdam|stad)/.test(msg)) add("regio");
  if (/(functie|rol|lesgeven|begeleid)/.test(msg)) add("functie");
  if (/(toelating|eisen|diploma|vooropleiding)/.test(msg)) add("toelating");

  // If nothing matched, offer exploration themes
  if (selected.length === 0) {
    add("route");
    add("sector");
  }

  return selected.slice(0, 3);
}
