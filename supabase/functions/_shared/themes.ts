/**
 * Shared Theme Module for Edge Functions
 * Mirror of src/utils/themeMapper.ts — same data, same logic.
 * Used by: doorai-chat, homepage-coach
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

/**
 * Derive themes based on phase + known/missing slots.
 * Used by personal pipeline (doorai-chat).
 */
export function deriveThemes(opts: {
  phase: string;
  knownSlots: Record<string, string>;
  missingSlots?: string[];
  maxThemes?: number;
  excludeKeys?: string[];
}): ThemeSignal[] {
  const { phase, knownSlots, missingSlots = [], maxThemes = 4, excludeKeys = [] } = opts;
  const p = phase.toLowerCase();
  const excluded = new Set(excludeKeys);
  const selected: ThemeSignal[] = [];
  const used = new Set<string>();

  function add(key: string) {
    if (used.has(key) || excluded.has(key)) return;
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
 * Derive themes for public/anonymous context based on user message keywords.
 * Used by public pipeline (homepage-coach).
 */
/**
 * Detect which theme keys the user message already covers,
 * so we can exclude them from follow-up actions.
 */
export function detectCurrentThemeKeys(userMessage: string): string[] {
  const msg = userMessage.toLowerCase();
  const keys: string[] = [];
  if (/(route|opleiding|zij-instroom|hoe word|leraar word)/.test(msg)) keys.push("route");
  if (/(vacature|baan|werk|school)/.test(msg)) keys.push("vacatures");
  if (/(salaris|verdien|loon|cao)/.test(msg)) keys.push("salaris");
  if (/(kosten|collegegeld|subsidie|financier|gratis)/.test(msg)) keys.push("kosten");
  if (/(bevoegdheid|eerste|tweede|graads)/.test(msg)) keys.push("bevoegdheid");
  if (/(event|open dag|meeloop)/.test(msg)) keys.push("events");
  if (/(regio|rotterdam|stad)/.test(msg)) keys.push("regio");
  if (/(functie|rol|lesgeven|begeleid)/.test(msg)) keys.push("functie");
  if (/(toelating|eisen|diploma|vooropleiding)/.test(msg)) keys.push("toelating");
  if (/(sector|po|vo|mbo|verschil)/.test(msg)) keys.push("sector");
  if (/(zij-instroom|zij instroom|zijinstroom)/.test(msg)) keys.push("zij_instroom");
  return keys;
}

export function publicThemes(userMessage: string, excludeKeys: string[] = []): ThemeSignal[] {
  const msg = userMessage.toLowerCase();
  const excluded = new Set(excludeKeys);
  const selected: ThemeSignal[] = [];
  const used = new Set<string>();

  function add(key: string) {
    if (used.has(key) || excluded.has(key)) return;
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

  // Fallback: exploration themes (excluding already-covered ones)
  if (selected.length === 0) {
    add("route");
    add("sector");
    add("salaris");
  }

  return selected.slice(0, 3);
}

/**
 * Convert ThemeSignals to UI actions (label + value).
 */
export function themesToActions(themes: ThemeSignal[], max = 2): Array<{ label: string; value: string }> {
  return themes.slice(0, max).map(t => ({ label: t.label, value: t.chatPrompt }));
}
