/**
 * Theme Mapper — shared utility that derives compact, UI-safe conversation themes
 * from phase + known/missing slots + SSOT signals.
 *
 * Used by: TopicMenu, phaseDetectorEngine, responsePipeline, PublicChatWidget
 * NOT used by edge functions (they use supabase/functions/_shared/themes.ts).
 */

export interface ThemeSignal {
  key: string;
  label: string;
  chatPrompt: string;
  chatPromptVariants?: string[];
}

const DOUBT_RE = /\b(twijfel|ik twijfel|weet niet|ik weet het niet|lastig kiezen|keuze maken|past dit|wel of niet|onzeker)\b/i;

// Meerdere varianten per thema → chips/suggesties roteren en voelen niet stug.
const ALL_THEMES: ThemeSignal[] = [
  { key: "keuzehulp", label: "Help me kiezen", chatPrompt: "Kun je mijn opties rustig naast elkaar zetten?",
    chatPromptVariants: ["Kun je mijn opties rustig naast elkaar zetten?", "Help me kiezen tussen de mogelijkheden.", "Wat past beter bij mijn situatie?"] },
  { key: "route", label: "Routes en opleidingen", chatPrompt: "Welke routes zijn er om in het onderwijs te werken?",
    chatPromptVariants: ["Welke routes zijn er om in het onderwijs te werken?", "Hoe ziet zo'n traject naar het onderwijs er voor mij uit?", "Welke wegen leiden naar de klas?"] },
  { key: "bevoegdheid", label: "Bevoegdheden", chatPrompt: "Welke bevoegdheid heb ik nodig?",
    chatPromptVariants: ["Welke bevoegdheid heb ik nodig?", "Welk papiertje moet ik straks hebben?", "Hoe weet ik welke bevoegdheid bij mij past?"] },
  { key: "vacatures", label: "Vacatures", chatPrompt: "Welke vacatures zijn er in het onderwijs?",
    chatPromptVariants: ["Welke vacatures zijn er in het onderwijs?", "Waar zit nu vraag in mijn regio?", "Welke scholen zoeken op dit moment?"] },
  { key: "salaris", label: "Salaris en arbeidsvoorwaarden", chatPrompt: "Wat verdient een leraar?",
    chatPromptVariants: ["Wat verdient een leraar?", "Wat kan ik straks ongeveer verdienen?", "Hoe zit het met salaris en voorwaarden?"] },
  { key: "kosten", label: "Kosten en financiering", chatPrompt: "Wat kost een opleiding en welke financiering is er?",
    chatPromptVariants: ["Wat kost een opleiding en welke financiering is er?", "Kan ik dit betalen zonder grote schuld?", "Hoe zit het met de kosten?"] },
  { key: "subsidie", label: "Subsidies en tegemoetkomingen", chatPrompt: "Welke subsidies zijn er voor aanstaande leraren?",
    chatPromptVariants: ["Welke subsidies zijn er voor aanstaande leraren?", "Is er een tegemoetkoming voor mijn situatie?", "Welke regelingen kan ik gebruiken?"] },
  { key: "regio", label: "Regio en scholen", chatPrompt: "Welke scholen en mogelijkheden zijn er in mijn regio?",
    chatPromptVariants: ["Welke scholen en mogelijkheden zijn er in mijn regio?", "Wat speelt er bij mij in de buurt?", "Welke opties zitten dichtbij?"] },
  { key: "toelating", label: "Toelatingseisen", chatPrompt: "Wat zijn de toelatingseisen?",
    chatPromptVariants: ["Wat zijn de toelatingseisen?", "Wat heb ik nodig om te starten?", "Welke vooropleiding wordt gevraagd?"] },
  { key: "functie", label: "Functies in het onderwijs", chatPrompt: "Welke functies zijn er in het onderwijs?",
    chatPromptVariants: ["Welke functies zijn er in het onderwijs?", "Wat kan ik doen naast lesgeven?", "Welke rollen passen bij mij?"] },
  { key: "sector", label: "Sectoren vergelijken", chatPrompt: "Wat zijn de verschillen tussen PO, VO en MBO?",
    chatPromptVariants: ["Wat zijn de verschillen tussen PO, VO en MBO?", "Welke leeftijdsgroep past bij mij?", "Wat is het verschil tussen basis, voortgezet en MBO?"] },
  { key: "next_step", label: "Volgende stap", chatPrompt: "Wat is mijn logische volgende stap?",
    chatPromptVariants: ["Wat is mijn logische volgende stap?", "Wat kan ik nu het beste doen?", "Hoe kom ik in beweging?"] },
  { key: "events", label: "Events en open dagen", chatPrompt: "Zijn er events of open dagen?",
    chatPromptVariants: ["Zijn er events of open dagen?", "Waar kan ik een dag meelopen?", "Wat zijn de aankomende meeloopmomenten?"] },
  { key: "zij_instroom", label: "Zij-instroom", chatPrompt: "Hoe werkt zij-instroom precies?",
    chatPromptVariants: ["Hoe werkt zij-instroom precies?", "Kan ik zij-instromen met mijn achtergrond?", "Wat houdt zij-instroom in voor iemand zoals ik?"] },
];

export function pickThemePrompt(t: ThemeSignal): string {
  const pool = t.chatPromptVariants && t.chatPromptVariants.length > 0 ? t.chatPromptVariants : [t.chatPrompt];
  return pool[Math.floor(Math.random() * pool.length)];
}

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
    add("keuzehulp");
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

  if (knownSlots.region_preference && !used.has("regio")) add("regio");
  if (missingSlots.includes("admission_requirements") && !used.has("toelating")) add("toelating");
  if ((missingSlots.includes("salary_info") || knownSlots.salary_info) && !used.has("salaris")) add("salaris");
  if ((missingSlots.includes("costs_info") || knownSlots.costs_info) && !used.has("kosten")) add("kosten");
  if (knownSlots.role_interest && !used.has("functie")) add("functie");

  return selected.slice(0, maxThemes);
}

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

export function publicThemes(userMessage: string): ThemeSignal[] {
  const msg = userMessage.toLowerCase();
  const selected: ThemeSignal[] = [];
  const used = new Set<string>();

  function add(key: string) {
    if (used.has(key)) return;
    const t = ALL_THEMES.find(th => th.key === key);
    if (t) { selected.push(t); used.add(key); }
  }

  if (DOUBT_RE.test(msg)) add("keuzehulp");
  if (/(route|opleiding|zij-instroom|hoe word|leraar word)/.test(msg)) add("route");
  if (/(vacature|baan|werk|school)/.test(msg)) add("vacatures");
  if (/(salaris|verdien|loon|cao)/.test(msg)) add("salaris");
  if (/(kosten|collegegeld|subsidie|financier|gratis)/.test(msg)) add("kosten");
  if (/(bevoegdheid|eerste|tweede|graads)/.test(msg)) add("bevoegdheid");
  if (/(event|open dag|meeloop)/.test(msg)) add("events");
  if (/(regio|rotterdam|stad)/.test(msg)) add("regio");
  if (/(functie|rol|lesgeven|begeleid)/.test(msg)) add("functie");
  if (/(toelating|eisen|diploma|vooropleiding)/.test(msg)) add("toelating");

  if (selected.length === 0) {
    add("route");
    add("sector");
  }

  return selected.slice(0, 3);
}
