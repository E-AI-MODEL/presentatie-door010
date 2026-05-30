/**
 * Shared Theme Module for Edge Functions
 * Mirror of src/utils/themeMapper.ts — same data, same logic.
 * Used by: doorai-chat, homepage-coach
 */

export interface ThemeSignal {
  key: string;
  label: string;
  chatPrompt: string;
  chatPromptVariants?: string[];
}

// Themaprompts zijn bewust kort, mensgericht en uitnodigend. Geen examen-toon.
// Meerdere varianten per thema zodat de chips niet altijd dezelfde vraag tonen.
const ALL_THEMES: ThemeSignal[] = [
  { key: "route", label: "Routes", chatPrompt: "Kun je me door de routes praten?",
    chatPromptVariants: ["Kun je me door de routes praten?", "Welke wegen leiden naar het onderwijs?", "Hoe ziet zo'n traject er voor mij uit?"] },
  { key: "bevoegdheid", label: "Bevoegdheid", chatPrompt: "Wat voor bevoegdheid past bij wat ik wil?",
    chatPromptVariants: ["Wat voor bevoegdheid past bij wat ik wil?", "Welk papiertje heb ik nodig om voor de klas te staan?", "Hoe weet ik welke bevoegdheid bij mij past?"] },
  { key: "vacatures", label: "Werk", chatPrompt: "Waar zit nu vraag in het onderwijs?",
    chatPromptVariants: ["Waar zit nu vraag in het onderwijs?", "Welke scholen zoeken nu mensen?", "Hoe staat het met de banen op dit moment?"] },
  { key: "salaris", label: "Verdienen", chatPrompt: "Wat kan ik straks ongeveer verdienen?",
    chatPromptVariants: ["Wat kan ik straks ongeveer verdienen?", "Hoe zit het met salaris in het onderwijs?", "Wat krijg ik betaald als ik instap?"] },
  { key: "kosten", label: "Kosten", chatPrompt: "Hoe zit het met kosten en financiering?",
    chatPromptVariants: ["Hoe zit het met kosten en financiering?", "Wat kost zo'n opleiding ongeveer?", "Kan ik dit betalen zonder vermogen op te bouwen aan schuld?"] },
  { key: "subsidie", label: "Subsidie", chatPrompt: "Is er steun of subsidie voor mijn situatie?",
    chatPromptVariants: ["Is er steun of subsidie voor mijn situatie?", "Welke regelingen zijn er voor zij-instromers?", "Kom ik in aanmerking voor een tegemoetkoming?"] },
  { key: "regio", label: "In de buurt", chatPrompt: "Wat speelt er bij mij in de buurt?",
    chatPromptVariants: ["Wat speelt er bij mij in de buurt?", "Welke scholen zitten in mijn regio?", "Wat zijn de opties dichtbij?"] },
  { key: "toelating", label: "Toelating", chatPrompt: "Wat heb ik nodig om te starten?",
    chatPromptVariants: ["Wat heb ik nodig om te starten?", "Wat zijn de instapeisen?", "Welke vooropleiding heb ik nodig?"] },
  { key: "functie", label: "Functies", chatPrompt: "Welke rollen zijn er naast voor de klas?",
    chatPromptVariants: ["Welke rollen zijn er naast voor de klas?", "Wat kan ik nog meer doen in het onderwijs?", "Zijn er functies buiten lesgeven?"] },
  { key: "sector", label: "PO, VO of MBO", chatPrompt: "Wat past het beste: PO, VO of MBO?",
    chatPromptVariants: ["Wat past het beste: PO, VO of MBO?", "Wat is het verschil tussen PO, VO en MBO?", "Welke leeftijdsgroep zou bij mij passen?"] },
  { key: "next_step", label: "Wat nu?", chatPrompt: "Wat is een logische volgende stap voor mij?",
    chatPromptVariants: ["Wat is een logische volgende stap voor mij?", "Wat kan ik nu het beste doen?", "Hoe kom ik in beweging?"] },
  { key: "events", label: "Open dagen", chatPrompt: "Zijn er binnenkort open dagen of meeloopdagen?",
    chatPromptVariants: ["Zijn er binnenkort open dagen of meeloopdagen?", "Waar kan ik een dag meelopen op een school?", "Wat zijn de aankomende events?"] },
  { key: "zij_instroom", label: "Zij-instroom", chatPrompt: "Hoe werkt zij-instroom voor iemand zoals ik?",
    chatPromptVariants: ["Hoe werkt zij-instroom voor iemand zoals ik?", "Kan ik zij-instromen met mijn achtergrond?", "Wat houdt zij-instroom precies in?"] },
];

function pickPrompt(t: ThemeSignal): string {
  const pool = t.chatPromptVariants && t.chatPromptVariants.length > 0 ? t.chatPromptVariants : [t.chatPrompt];
  return pool[Math.floor(Math.random() * pool.length)];
}

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
  return themes.slice(0, max).map(t => ({ label: t.label, value: pickPrompt(t) }));
}
