import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deriveThemes, themesToActions, detectCurrentThemeKeys } from "../_shared/themes.ts";
import { FORBIDDEN_TERMS, MODELS } from "../_shared/constants.ts";
import { sanitizeAssistantText } from "../_shared/sanitize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ══════════════════════════════════════════════════════════════════════
// DoorAI CHAT ORCHESTRA v3 — fase-doorstroom + webfallback + SSOT kennis
// ══════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

type SlotKey =
  | "school_type"
  | "role_interest"
  | "credential_goal"
  | "admission_requirements"
  | "duration_info"
  | "costs_info"
  | "salary_info"
  | "region_preference"
  | "next_step";

interface DetectorPayload {
  audience: string;
  phase_current: string;
  phase_current_ui: string;
  phase_confidence: number;
  evidence: string[];
  known_slots: Partial<Record<SlotKey, string>>;
  missing_slots: SlotKey[];
  next_slot_key: SlotKey;
  next_question_id: string;
  next_question: string;
  next_phase_target?: string;
  exit_criteria_met?: boolean;
  phase_suggestion?: {
    from: string;
    to: string;
    message: string;
  };
}

interface PhaseTransition { from: string; to: string }

interface ProfileMeta {
  first_name?: string | null;
  bio?: string | null;
  test_completed?: boolean | null;
  test_results?: Record<string, unknown> | null;
  preferred_sector?: string | null;
  current_phase?: string | null;
}

interface RequestBody {
  messages: ChatMessage[];
  mode?: "authenticated";
  userPhase?: string;
  userSector?: string;
  detector?: DetectorPayload;
  phase_transition?: PhaseTransition;
  profileMeta?: ProfileMeta;
}

type IntentType = "greeting" | "question" | "exploration" | "followup";
type UiAction = { label: string; value: string };
type UiLink = { label: string; href: string };

// ─────────────────────────────────────────────────────────────────────
// Slot Normalisatie
// ─────────────────────────────────────────────────────────────────────
const SCHOOL_TYPE_ALIASES: Record<string, string> = {
  po: "PO", basisonderwijs: "PO", basisschool: "PO", primair: "PO",
  vo: "VO", voortgezet: "VO", middelbaar: "VO", "middelbare school": "VO",
  mbo: "MBO", beroepsonderwijs: "MBO",
  vavo: "VAVO", ho: "HO", "hoger onderwijs": "HO",
  so: "SO_VSO", vso: "SO_VSO", "speciaal onderwijs": "SO_VSO",
};

const ROLE_ALIASES: Record<string, string> = {
  lesgeven: "leraar", leraar: "leraar", docent: "leraar",
  begeleiden: "leerlingenzorg", begeleiding: "leerlingenzorg",
  vakexpertise: "instructeur", instructeur: "instructeur",
  ondersteuning: "onderwijsondersteunend_personeel",
  onderwijsassistent: "onderwijsondersteunend_personeel",
  schoolleiding: "schoolleiding", directeur: "schoolleiding",
  middenmanagement: "middenmanagement", teamleider: "middenmanagement",
  leerlingenzorg: "leerlingenzorg",
};

function normalizeSchoolType(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  return SCHOOL_TYPE_ALIASES[raw.toLowerCase().trim()] || raw.toUpperCase();
}

function normalizeRole(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  return ROLE_ALIASES[raw.toLowerCase().trim()] || raw.toLowerCase().trim();
}

function normalizeSlots(
  slots: Partial<Record<SlotKey, string>>,
  userSector?: string,
): Partial<Record<SlotKey, string>> {
  const out = { ...slots };
  out.school_type = normalizeSchoolType(slots.school_type || userSector) || out.school_type;
  out.role_interest = normalizeRole(slots.role_interest) || out.role_interest;
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Truncation helpers
// ─────────────────────────────────────────────────────────────────────
function truncate(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : text.slice(0, maxChars) + "...";
}

function truncateInput(text: string, maxChars = 2000): string {
  return text.slice(0, maxChars);
}

// ─────────────────────────────────────────────────────────────────────
// SSOT Data
// ─────────────────────────────────────────────────────────────────────

const ROLE_DESCRIPTIONS: Record<string, string> = {
  leraar: "Een leraar draagt verantwoordelijkheid voor een klas. In de meeste gevallen moeten leraren wettelijk aan bekwaamheidseisen voldoen.",
  onderwijsondersteunend_personeel: "Ondersteunende functies direct bij de lespraktijk: onderwijsassistenten, remedial teachers, leraarondersteuners, klassenassistenten.",
  ondersteunend_personeel: "Organisatorische functies niet direct bij het leerproces: concierge, administratie, roostermaker.",
  schoolleiding: "De dagelijkse leiding van een school: directeur (PO), rector (VO), of directie (MBO).",
  middenmanagement: "Bouwcoordinatoren (PO), teamleiders (VO), opleidingsmanagers (MBO). Samen met de schoolleiding het managementteam.",
  instructeur: "In het mbo verantwoordelijk voor de praktijkonderdelen. Geeft zelfstandig (delen van) lessen onder verantwoordelijkheid van een docent.",
  leerlingenzorg: "Intern Begeleider (PO), Zorgcoordinator (VO), studieadviseur (MBO/HO), orthopedagoog (speciaal onderwijs).",
};

interface DeskInfo {
  title: string;
  email: string | null;
  website: string | null;
  consultUrl: string | null;
  hasConsultation: boolean;
  cities: string[];
}

const REGIONAL_DESKS_LIST: DeskInfo[] = [
  { title: "SchoolpleinNoord", email: "info@schoolpleinnoord.nl", website: "https://schoolpleinnoord.nl/", consultUrl: "https://schoolpleinnoord.nl/contact", hasConsultation: true, cities: ["groningen", "leeuwarden", "drachten", "heerenveen", "assen", "sneek", "delfzijl", "stadskanaal", "veendam", "emmen", "hoogeveen", "meppel"] },
  { title: "VOTA", email: "instroommakelaar@vota.nl", website: "https://vota.nl", consultUrl: "https://vota.nl/contact", hasConsultation: true, cities: ["almelo", "enschede", "hengelo", "deventer", "oldenzaal", "twente"] },
  { title: "Foodvalley Leerwerkloket", email: "arbeidsmarktregio@ede.nl", website: "https://kiesjekans.nl/branches/onderwijs", consultUrl: "https://www.kiesjekans.nl/contact", hasConsultation: true, cities: ["barneveld", "veenendaal", "ede", "wageningen", "renkum", "rhenen", "nijkerk", "foodvalley"] },
  { title: "Onderwijsloket Nijmegen", email: "contact@onderwijsloketnijmegen.nl", website: "https://onderwijsloketnijmegen.nl/", consultUrl: "https://onderwijsloketnijmegen.nl/contact", hasConsultation: true, cities: ["nijmegen", "lent"] },
  { title: "Grijp je kans in het onderwijs", email: "info@grijpjekansinhetonderwijs.nl", website: "https://grijpjekansinhetonderwijs.nl", consultUrl: "https://www.grijpjekansinhetonderwijs.nl/contact", hasConsultation: true, cities: ["eindhoven", "helmond", "'s-hertogenbosch", "den bosch", "geldrop", "deurne", "vught", "oss", "brabant-oost"] },
  { title: "Onderwijsloket Arnhem", email: "info@onderwijsloketarnhem.nl", website: "https://onderwijsregioloa.nl", consultUrl: "https://onderwijsloketarnhem.nl/contact", hasConsultation: true, cities: ["arnhem", "lingewaard", "overbetuwe"] },
  { title: "Aan de slag in het Haagse Basisonderwijs", email: "info@aandeslaginhethaagsebasisonderwijs.nl", website: "https://www.aandeslaginhethaagsebasisonderwijs.nl/", consultUrl: "https://www.aandeslaginhethaagsebasisonderwijs.nl/", hasConsultation: true, cities: ["den haag", "haaglanden"] },
  { title: "Leraar worden in Leiden", email: null, website: "https://www.leraarwordeninleidenduinenbollenstreek.nl/", consultUrl: "https://www.leraarwordeninleidenduinenbollenstreek.nl/leraar-worden/meld-je-aan/", hasConsultation: true, cities: ["leiden", "leiderdorp", "katwijk", "noordwijk", "bollenstreek"] },
  { title: "Utrecht leert", email: "welkom@utrechtleert.nl", website: "https://utrechtleert.nl/utrechtse-energie/", consultUrl: null, hasConsultation: false, cities: ["utrecht"] },
  { title: "Hatseklas", email: "info@hatseklas.nl", website: "https://hatseklas.nl", consultUrl: "https://hatseklas.nl/contact/", hasConsultation: true, cities: ["zwolle", "apeldoorn", "kampen", "harderwijk", "nunspeet", "overijssel"] },
  { title: "Midden Nederland Leert", email: "Instroom@middennederlandleert.nl", website: "https://middennederlandleert.nl/", consultUrl: "https://middennederlandleert.nl/contact/", hasConsultation: true, cities: ["amersfoort", "hilversum", "houten", "zeist", "soest", "baarn", "woerden", "nieuwegein"] },
  { title: "Liever voor de klas", email: "info@lievervoordeklas.nl", website: "https://www.lievervoordeklas.nl/persoonlijk-advies", consultUrl: "https://www.lievervoordeklas.nl/persoonlijk-advies", hasConsultation: true, cities: ["amsterdam"] },
  { title: "Stappen in het onderwijs", email: null, website: "https://stappeninhetonderwijs.nl/", consultUrl: null, hasConsultation: false, cities: ["breda", "tilburg", "roosendaal", "bergen op zoom", "west-brabant"] },
  { title: "Onderwijsloket Rotterdam", email: "info@onderwijsloketrotterdam.nl", website: "https://onderwijsloketrotterdam.nl/", consultUrl: null, hasConsultation: false, cities: ["rotterdam", "barendrecht", "capelle aan den ijssel", "schiedam", "vlaardingen", "maassluis", "ridderkerk", "delft", "gouda", "rijnmond"] },
  { title: "Ik word leerkracht", email: null, website: "https://ikwordleerkracht.nl/", consultUrl: "https://ikwordleerkracht.nl/persoonlijk-advies/", hasConsultation: true, cities: ["haarlemmermeer", "hoofddorp"] },
  { title: "Koerskracht", email: "info@koerskracht.nu", website: "https://koerskracht.nu", consultUrl: "https://koerskracht.nu", hasConsultation: true, cities: ["dordrecht", "gorinchem", "papendrecht", "sliedrecht", "zwijndrecht"] },
  { title: "Landelijk Groen", email: null, website: "https://www.werkeningroenonderwijs.nl/", consultUrl: "https://www.werkeningroenonderwijs.nl/contact", hasConsultation: true, cities: ["groen onderwijs", "agrarisch"] },
  { title: "Talent als Docent", email: null, website: "https://talentalsdocent.nl/", consultUrl: null, hasConsultation: false, cities: ["haarlem", "velsen", "amstelveen", "beverwijk"] },
  { title: "Leraar van Buiten", email: null, website: "https://www.leraarvanbuiten.nl/", consultUrl: null, hasConsultation: false, cities: ["rotterdam", "schiedam", "vlaardingen", "ridderkerk", "barendrecht", "rijnmond"] },
  { title: "Onderwijsloket Friesland", email: null, website: "https://www.onderwijsloketfriesland.nl/", consultUrl: "https://www.onderwijsloketfriesland.nl/contact", hasConsultation: true, cities: ["leeuwarden", "heerenveen", "drachten", "sneek", "friesland"] },
  { title: "Samen voor de Haagse Klas", email: null, website: "https://samenvoordehaagseklas.nl", consultUrl: null, hasConsultation: false, cities: ["den haag"] },
];

// ─────────────────────────────────────────────────────────────────────
// SSOT Lookup Functions
// ─────────────────────────────────────────────────────────────────────
function findRoleDescription(role: string): string | null {
  const key = normalizeRole(role);
  if (key && ROLE_DESCRIPTIONS[key]) return ROLE_DESCRIPTIONS[key];
  for (const [k, v] of Object.entries(ROLE_DESCRIPTIONS)) {
    if (role.toLowerCase().includes(k) || k.includes(role.toLowerCase())) return v;
  }
  return null;
}

function findDeskObjects(regionOrCity: string): DeskInfo[] {
  const key = regionOrCity.toLowerCase().trim();
  const results: DeskInfo[] = [];
  for (const desk of REGIONAL_DESKS_LIST) {
    if (desk.cities.some(c => key.includes(c) || c.includes(key))) {
      results.push(desk);
      if (results.length >= 3) break;
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────
// Knowledge Blocks
// ─────────────────────────────────────────────────────────────────────
const KNOWLEDGE: Record<string, string> = {
  lesgeven_po: "Leraar PO: verantwoordelijk voor een klas op de basisschool (groep 1-8). Pabo-diploma of zij-instroom PO-traject vereist.",
  lesgeven_vo: "Leraar VO: les in een specifiek vak op de middelbare school. Tweedegraads (4 jr hbo) voor onderbouw/vmbo, eerstegraads (master) voor bovenbouw havo/vwo.",
  lesgeven_mbo: "Docent MBO: theorie- en praktijklessen in beroepsopleidingen. PDG (1-2 jr) vereist, of een eerste/tweedegraads bevoegdheid. Vakkennis aantoonbaar via diploma of minimaal 3 jaar werkervaring.",
  route_pabo: "Pabo: 4 jaar voltijd (of deeltijd). Toelatingseis: havo, vwo of mbo-4. Zij-instroom PO is alternatief voor hbo/wo-gediplomeerden (2 jaar).",
  route_tweedegraads: "Tweedegraads lerarenopleiding: 4 jaar hbo. Bevoegd voor vmbo en onderbouw havo/vwo. Zij-instroom VO is versneld (2 jaar).",
  route_eerstegraads: "Eerstegraads: universitaire master (1-2 jaar) na vakinhoudelijke bachelor. Bevoegd voor alle VO-niveaus.",
  route_pdg: "PDG (Pedagogisch Didactisch Getuigschrift): 1-2 jaar naast het werk. Bedoeld voor vakmensen die in het MBO willen lesgeven.",
  route_zij_instroom: "Zij-instroom: versneld 2-jarig traject. Je werkt minimaal 0,4 fte en volgt 1 dag per week opleiding. Vereist: relevant hbo/wo-diploma, geschiktheidsonderzoek, VOG, aanstelling bij een school.",
  salaris: `Salaris startend docent (CAO PO 2025-2026 / VO 2026-2027): LB-schaal trede 1 ca. EUR 3.890, trede 12 ca. EUR 5.880 bruto/mnd. MBO (CAO 2025-2026): trede 1 ca. EUR 3.970, trede 12 ca. EUR 5.870. Inschaling hangt af van werkervaring en schoolbeleid. Meer info: [CAO-tabellen](https://www.poraad.nl/salaristabellen).`,
  kosten: `Kosten: zij-instroom is kosteloos (school vraagt subsidie aan). Regulier wettelijk collegegeld is EUR 2.601 in 2025-2026 en EUR 2.660 in 2026-2027. PDG varieert per aanbieder. Meer info: [DUO collegegeld](https://duo.nl/particulier/collegegeld/).`,
  verwantschap: "Bij zij-instroom tweedegraads VO moet je diploma vakinhoudelijk verwant zijn aan het schoolvak. De opleiding beslist over toelating.",
  sool_subsidie: "De SOOL-subsidie kan beschikbaar zijn voor scholen die medewerkers laten opleiden tot leraar. Check bij het regioloket of je werkgever hiervoor in aanmerking komt.",
  bevoegdheden_mbo: "In het MBO is 'bevoegd' geen wettelijke term. Je kunt lesgeven met een eerste/tweedegraads bevoegdheid, of met een geschiktheidsverklaring plus PDG.",
};

const BASELINE_KNOWLEDGE = `Het landelijke Onderwijsloket (onderwijsloket.com) biedt informatie over routes en bevoegdheden. Regionale onderwijsloketten bieden persoonlijke begeleiding. Routes lopen via reguliere opleidingen of via zij-instroom. Handige tools: [Routetool](https://onderwijsloket.com/routes/), [Onderwijsnavigator](https://onderwijsloket.com/onderwijsnavigator/).`;

// ─────────────────────────────────────────────────────────────────────
// Knowledge Resolver — now includes phase-specific knowledge
// ─────────────────────────────────────────────────────────────────────
function resolveKnowledge(
  slots: Partial<Record<SlotKey, string>>,
  phase: string,
  userMessage?: string,
): string[] {
  const fragments: string[] = [];
  const role = slots.role_interest;
  const sector = slots.school_type;
  const p = (phase || "interesseren").toLowerCase();
  const msg = (userMessage || "").toLowerCase();

  // Role description
  if (role) {
    const desc = findRoleDescription(role);
    if (desc) fragments.push(desc);
    if (sector && (role === "leraar" || role === "instructeur")) {
      const key = `lesgeven_${sector.toLowerCase()}`;
      if (KNOWLEDGE[key] && !fragments.some(f => f.includes(KNOWLEDGE[key].slice(0, 30)))) {
        fragments.push(KNOWLEDGE[key]);
      }
    }
  }

  // Route info for orienteren/beslissen
  if (p === "orienteren" || p === "beslissen") {
    if (sector === "PO") fragments.push(KNOWLEDGE.route_pabo);
    else if (sector === "VO") fragments.push(KNOWLEDGE.route_tweedegraads);
    else if (sector === "MBO") {
      fragments.push(KNOWLEDGE.route_pdg);
      fragments.push(KNOWLEDGE.bevoegdheden_mbo);
    }
    if (slots.credential_goal?.toLowerCase().includes("zij")) {
      fragments.push(KNOWLEDGE.route_zij_instroom);
      if (sector === "VO") fragments.push(KNOWLEDGE.verwantschap);
    }
  }

  // Salary/costs — trigger on slot OR on message content
  if (slots.salary_info || p === "beslissen" || /(salaris|verdien|loon|cao|inkomen)/.test(msg)) {
    fragments.push(KNOWLEDGE.salaris);
  }
  if (slots.costs_info || p === "beslissen" || /(kosten|collegegeld|gratis|subsidie|betalen)/.test(msg)) {
    fragments.push(KNOWLEDGE.kosten);
  }

  // Region — desk info
  if (slots.region_preference) {
    const desks = findDeskObjects(slots.region_preference);
    for (const desk of desks) {
      let info = `Regionaal loket: ${desk.title}`;
      if (desk.website) info += ` - ${desk.website}`;
      if (desk.hasConsultation) info += " (persoonlijk gesprek mogelijk)";
      fragments.push(info);
    }
  }

  return fragments;
}

// ─────────────────────────────────────────────────────────────────────
// Link Computation
// ─────────────────────────────────────────────────────────────────────
function computeLinks(
  phase: string,
  slots: Partial<Record<SlotKey, string>>,
  userMessage: string,
  trustedDomains: Set<string>,
): UiLink[] {
  const links: UiLink[] = [];
  const msg = userMessage.toLowerCase();
  const p = phase.toLowerCase();

  // Internal links based on phase
  if (p === "orienteren" || p === "beslissen" || /(route|opleiding|zij-instroom|bevoegdheid)/.test(msg)) {
    links.push({ label: "Routes bekijken", href: "/opleidingen" });
  }
  if (p === "matchen" || /(vacature|baan|werk|school)/.test(msg)) {
    links.push({ label: "Vacatures", href: "/vacatures" });
  }
  if (/(event|open dag|meeloop|proefles|banenmarkt)/.test(msg)) {
    links.push({ label: "Events", href: "/events" });
  }
  if (/(salaris|cao|loon)/.test(msg)) {
    links.push({ label: "CAO-tabellen", href: "https://www.vo-raad.nl/themas/arbeidsvoorwaarden-cao" });
  }
  if (/(kosten|collegegeld|duo|financiering)/.test(msg)) {
    links.push({ label: "DUO Studiekosten", href: "https://duo.nl" });
  }

  // External: routetool
  if (/(route|welke route|zij-instroom|hoe word)/.test(msg) || p === "orienteren") {
    links.push({ label: "Routetool", href: "https://onderwijsloket.com/routes/" });
  }

  // Regional desk links
  if (slots.region_preference) {
    for (const desk of findDeskObjects(slots.region_preference)) {
      if (desk.website) links.push({ label: desk.title, href: desk.website });
    }
  }

  // Filter external links against trusted_sources whitelist
  const filtered = links.filter(l => {
    if (!l.href.startsWith("http")) return true; // internal links always pass
    try {
      const linkDomain = new URL(l.href).hostname.replace(/^www\./, "");
      return trustedDomains.has(linkDomain);
    } catch {
      return false;
    }
  });

  const uniq = new Map<string, UiLink>();
  for (const l of filtered) uniq.set(l.href, l);
  return [...uniq.values()].slice(0, 6);
}

function computeTextLinks(faqSourceLinks: UiLink[]): string {
  const external = faqSourceLinks.filter(l => l.href.startsWith("http"));
  const selected = external.slice(0, 2);
  if (selected.length === 0) return "";
  return selected.map(l => `- [${l.label}](${l.href})`).join("\n");
}

// ─────────────────────────────────────────────────────────────────────
// Actions — context-aware chip options per slot
// ─────────────────────────────────────────────────────────────────────
function actionsForNextSlot(
  slot: SlotKey,
  knownSlots?: Partial<Record<SlotKey, string>>,
  phase?: string,
): UiAction[] {
  if (slot === "school_type") {
    // Context-aware: if role suggests a sector, reorder
    if (knownSlots?.role_interest === "instructeur") {
      return [
        { label: "MBO (instructeur)", value: "MBO" },
        { label: "VO (vakleerkracht)", value: "VO" },
        { label: "PO (vakspecialist)", value: "PO" },
      ];
    }
    // Broader set including less common sectors
    const base: UiAction[] = [
      { label: "Basisonderwijs (PO)", value: "PO" },
      { label: "Voortgezet onderwijs (VO)", value: "VO" },
      { label: "MBO", value: "MBO" },
    ];
    // Add SO/VSO for later phases where user might be more specific
    if (phase === "orienteren" || phase === "beslissen") {
      base.push({ label: "Speciaal onderwijs", value: "SO_VSO" });
    }
    return base;
  }
  if (slot === "role_interest") {
    const base: UiAction[] = [
      { label: "Lesgeven", value: "leraar" },
      { label: "Leerlingbegeleiding", value: "leerlingenzorg" },
      { label: "Vakexpertise / instructeur", value: "instructeur" },
    ];
    // In later phases, show broader role options
    if (phase === "matchen" || phase === "voorbereiden") {
      base.push({ label: "Onderwijsondersteuning", value: "onderwijsondersteunend_personeel" });
    }
    return base;
  }
  if (slot === "credential_goal") {
    return [
      { label: "Route naar bevoegdheid", value: "po_bevoegdheid" },
      { label: "Eerst verkennen", value: "verkennen" },
    ];
  }
  if (slot === "admission_requirements") {
    return [
      { label: "MBO-diploma", value: "mbo" },
      { label: "HBO-diploma", value: "hbo" },
      { label: "WO-diploma", value: "wo" },
      { label: "Buitenlands diploma", value: "buitenlands" },
    ];
  }
  if (slot === "region_preference") {
    return [
      { label: "Regio Rotterdam", value: "rotterdam" },
      { label: "Andere regio", value: "andere_regio" },
    ];
  }
  if (slot === "next_step") {
    const base: UiAction[] = [
      { label: "Vacatures bekijken", value: "vacatures" },
      { label: "Gesprek plannen", value: "gesprek" },
    ];
    if (phase === "interesseren" || phase === "orienteren") {
      base.push({ label: "Events bekijken", value: "events" });
    } else {
      base.push({ label: "Direct aanmelden", value: "aanmelden" });
    }
    return base;
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────
// Tone & Profile
// ─────────────────────────────────────────────────────────────────────
const TONE_TABLE: Record<string, { early: string; late: string }> = {
  interesseren: { early: "Luchtig en nieuwsgierig.", late: "Bevestigend, richting concrete stap." },
  orienteren: { early: "Opties naast elkaar, zonder keuzestress.", late: "Gericht op de gekozen route." },
  beslissen: { early: "Twijfel normaliseren, twee opties max.", late: "Concreet: aanmelden, gesprek, event." },
  matchen: { early: "Praktisch: regio, sector, type school.", late: "Doorverwijzen naar vacatures of loket." },
  voorbereiden: { early: "Kort en zakelijk, checklist-stijl.", late: "Afsluitend met aanmoediging." },
};

function selectTone(phase: string, filled: number, total: number): string {
  const entry = TONE_TABLE[phase.toLowerCase()] || TONE_TABLE.interesseren;
  return (total > 0 && filled / total >= 0.5) ? entry.late : entry.early;
}

function interpretProfile(pm?: ProfileMeta | null): string {
  if (!pm) return "";
  const parts: string[] = [];
  if (pm.first_name) parts.push(`De gebruiker heet ${pm.first_name}.`);
  if (pm.bio) parts.push(`Achtergrond: ${pm.bio.slice(0, 120)}.`);

  // Sector from profile
  if (pm.preferred_sector) {
    const sectorNames: Record<string, string> = { po: "basisonderwijs (PO)", vo: "voortgezet onderwijs (VO)", mbo: "beroepsonderwijs (MBO)", so: "speciaal onderwijs (SO)" };
    const sectorLabel = sectorNames[pm.preferred_sector.toLowerCase()] || pm.preferred_sector;
    parts.push(`Voorkeurssector: ${sectorLabel}.`);
  }

  // Phase from profile — neutral description, never the bare label.
  if (pm.current_phase) {
    const phaseDescs: Record<string, string> = {
      interesseren: "verkent nog of het onderwijs past",
      orienteren: "bekijkt routes en opties",
      beslissen: "staat voor een concrete keuze",
      matchen: "zoekt een school of opleiding",
      voorbereiden: "bereidt zich voor op de start",
    };
    const desc = phaseDescs[pm.current_phase.toLowerCase()];
    if (desc) parts.push(`De gebruiker ${desc}.`);
  }

  if (pm.test_completed && pm.test_results) {
    const tr = pm.test_results;
    if (tr.ranking && Array.isArray(tr.ranking)) {
      const ranking = tr.ranking as Array<{ sector: string; score: number }>;
      const names: Record<string, string> = { po: "basisonderwijs (PO)", vo: "voortgezet onderwijs (VO)", mbo: "beroepsonderwijs (MBO)" };
      const top = ranking[0];
      if (top) parts.push(`Past qua interesse het best bij ${names[String(top.sector).toLowerCase()] || top.sector}.`);
    }
  }

  // Fallback hint when profile is essentially empty
  if (parts.length === 0) {
    return "De gebruiker heeft nog geen profielinformatie ingevuld. Houd je antwoord breed en toegankelijk, en moedig aan om meer over zichzelf te vertellen zodat je gerichter kunt adviseren.";
  }

  return parts.join(" ");
}

function humanizeSituation(
  phase: string,
  slots: Partial<Record<SlotKey, string>>,
): string {
  const parts: string[] = [];
  const descs: Record<string, string> = {
    interesseren: "verkent of het onderwijs iets is",
    orienteren: "bekijkt welke richting het beste past",
    beslissen: "staat voor een keuze",
    matchen: "zoekt een concrete school of opleiding",
    voorbereiden: "maakt zich klaar voor de start",
  };
  parts.push(`De gebruiker ${descs[phase.toLowerCase()] || descs.interesseren}.`);

  const sectorNames: Record<string, string> = { PO: "het basisonderwijs", VO: "het voortgezet onderwijs", MBO: "het mbo" };
  const role = slots.role_interest;
  const sector = slots.school_type;

  if (role && sector) parts.push(`Interesse in ${role} in ${sectorNames[sector] || sector}.`);
  else if (role) parts.push(`Interesse in ${role}.`);
  else if (sector) parts.push(`Gericht op ${sectorNames[sector] || sector}.`);

  if (slots.region_preference) parts.push(`Zoekt in de regio ${slots.region_preference}.`);
  if (slots.admission_requirements) parts.push(`Vooropleiding: ${slots.admission_requirements}.`);
  return parts.join(" ");
}

// ─────────────────────────────────────────────────────────────────────
// Web Fallback — search trusted sources via Firecrawl
// ─────────────────────────────────────────────────────────────────────
async function fetchTrustedSources(): Promise<Array<{ url: string; label: string; category: string }>> {
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await supabase
      .from("trusted_sources")
      .select("url, label, category")
      .eq("active", true);
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

async function webFallbackSearch(
  userMessage: string,
  trustedSources: Array<{ url: string }>,
): Promise<string[]> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY || trustedSources.length === 0) return [];

  try {
    // Build site filter from trusted sources (max 5 for query length)
    const siteFilter = trustedSources.slice(0, 5).map(s => `site:${s.url}`).join(" OR ");
    const query = `${userMessage} (${siteFilter})`;

    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: truncateInput(query, 300),
        limit: 3,
        lang: "nl",
        country: "nl",
        scrapeOptions: { formats: ["markdown"] },
      }),
    });

    if (!response.ok) {
      console.error("Firecrawl search error:", response.status);
      return [];
    }

    const data = await response.json();
    if (!data.success || !data.data) return [];

    return data.data
      .filter((r: { markdown?: string; url?: string }) => r.markdown)
      .slice(0, 2)
      .map((r: { markdown?: string; url?: string; title?: string }) => {
        // Strip markdown artefacts (headings, bullets, table pipes, bold/italic)
        // before injecting into the system prompt, and never include the raw URL —
        // the model regularly echoes "Bron: https://..." verbatim.
        const cleaned = truncate((r.markdown || "")
          .replace(/^#{1,6}\s+/gm, "")
          .replace(/^[-*]\s+/gm, "")
          .replace(/\|/g, " ")
          .replace(/\*\*|__/g, "")
          .replace(/\s+/g, " ")
          .trim(), 300);
        return cleaned;
      });
  } catch (e) {
    console.error("Web fallback error:", e);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────
// Context Assembler — bronhiërarchie met anti-bias
// Volgorde van prioriteit voor het model:
//   1. Verse externe bronnen (Firecrawl op whitelist trusted_sources)
//   2. Interne kennisbank (FAQ met peildatum; verouderd wordt gemarkeerd)
//   3. Basiskennis SSOT (alleen fallback bij sparse external/FAQ data)
// ─────────────────────────────────────────────────────────────────────
function assembleContext(
  phase: string,
  detector: DetectorPayload | undefined,
  profileMeta: ProfileMeta | undefined | null,
  userSector: string | undefined,
  phaseTransition: PhaseTransition | undefined,
  intent: IntentType,
  faqKnowledge: string[],
  textLinks: string,
  webKnowledge: string[],
  userMessage: string,
): string {
  const slots = normalizeSlots(detector?.known_slots || {}, userSector);
  const filled = Object.values(slots).filter(Boolean).length;
  const total = detector?.missing_slots ? filled + detector.missing_slots.length : 9;

  const tone = selectTone(phase, filled, total);
  const profile = interpretProfile(profileMeta);
  const situation = humanizeSituation(phase, slots);

  const parts: string[] = [];
  parts.push(`Toon: ${tone}`);
  parts.push(`Situatie: ${situation}`);

  if (intent === "question" || intent === "followup" || intent === "exploration") {
    const ssotKnowledge = resolveKnowledge(slots, phase, userMessage);
    const sections: string[] = [];

    // 1. Verse externe bronnen — leidend
    if (webKnowledge.length > 0) {
      sections.push(`## Verse externe bronnen (laatst opgehaald, leidend bij tegenspraak)\n${webKnowledge.map(k => `- ${k}`).join("\n")}`);
    }
    // 2. Interne kennisbank
    if (faqKnowledge.length > 0) {
      sections.push(`## Interne kennisbank\n${faqKnowledge.map(k => `- ${k}`).join("\n")}`);
    }
    // 3. Basiskennis — alleen als fallback / context
    if (ssotKnowledge.length > 0) {
      sections.push(`## Basiskennis (fallback, gebruik alleen als hierboven niets staat)\n${ssotKnowledge.map(k => `- ${k}`).join("\n")}`);
    }
    if (sections.length === 0) {
      sections.push(`## Basiskennis\n${BASELINE_KNOWLEDGE}`);
    }

    parts.push(
      `\nKennisbronnen voor je antwoord:\n${sections.join("\n\n")}\n\n` +
      `Regels bij tegenspraak: kies altijd de meest recente bron. ` +
      `Een fragment dat "(mogelijk verouderd, ...)" zegt mag je niet als feit presenteren — verwijs dan naar de externe bron of geef aan dat je het laat checken. ` +
      `Noem nooit de sectienamen ("Verse externe bronnen", "Interne kennisbank", "Basiskennis") in je antwoord.`
    );
  }

  if (profile) parts.push(`\nOver de gebruiker: ${profile}`);

  if (phaseTransition) {
    parts.push(`\nDe gebruiker is klaar voor een nieuwe stap. Erken dit kort en positief, zonder interne stap- of fasenamen te noemen.`);
  }

  if (textLinks && intent !== "greeting") {
    parts.push(`\nRelevante links (gebruik max 2 als markdown-links in je antwoord waar ze passen):\n${textLinks}`);
  }

  const assembled = parts.join("\n");
  if (assembled.length > 3600) return parts.slice(0, 4).join("\n");
  return assembled;
}

// ─────────────────────────────────────────────────────────────────────
// System Prompt
// ─────────────────────────────────────────────────────────────────────
const DOORAI_CORE = `Je bent DoorAI, de orientatie-assistent van Onderwijsloket Rotterdam.

## Rol
- Warme, nuchtere wegwijzer: menselijk, direct, vriendelijk.
- Je helpt mensen orienteren op werken in het onderwijs.
- Positief zonder overdrijving. Je bent geen recruiter.

## BELANGRIJKSTE REGEL: KORT ANTWOORDEN
- MAXIMAAL 3 ZINNEN per antwoord. Dit is de allerbelangrijkste regel.
- Geen opsommingen, geen genummerde lijsten, geen stappen-overzichten.
- GEEN tekst tussen vierkante haken zoals [Landelijk], [Regionaal], [Label]. Nooit.
- GEEN subkopjes, geen structurering. Schrijf gewoon lopende tekst.
- Eén kernpunt per antwoord. Niet alles tegelijk uitleggen.
- Stel maximaal 1 vervolgvraag per beurt, altijd als laatste zin.

## Links in je antwoord
- Linkchips verschijnen automatisch onder je antwoord. Herhaal ze NOOIT in de prose.
- Schrijf NOOIT interne URL-paden als zichtbare tekst. Geen "(/opleidingen)", geen "/vacatures", geen "[label](/pad)". De chips doen dat al.
- Alleen voor specifieke externe bronnen (CAO, DUO) mag je een markdown-link gebruiken met een beschrijvend anker.

## Grenzen
- Bij salaris: alleen globaal, verwijs naar CAO.
- Schrijf NOOIT e-mails, brieven of scripts.

## Stijl
- Korte zinnen, weinig jargon. NOOIT bullets of lijsten.
- Geen emojis. Geen emdash of endash (gebruik "-").
- Geef het directe antwoord, niet het hele verhaal.

## Verboden
- Opsommingen, stappen, bullets, genummerde lijsten.
- Tekst tussen vierkante haken: [Landelijk], [Regionaal], [Stap 1], etc.
- Zinnen als "Het traject ziet er globaal zo uit:" gevolgd door stappen.
- Verwijs NOOIT naar UI-elementen in je tekst: niet naar "suggesties", "het menu", "chips", "de knop", "het overzicht hieronder", "via de tegel", "klik op", "kies hieronder", "zie linkjes onder". De gebruiker ziet die elementen al; benoem ze niet.
- Schrijf NOOIT een intern pad zichtbaar in de tekst (geen "/opleidingen", "/vacatures", "/events", "/kennisbank", "/profile", "/dashboard"), ook niet tussen haakjes.
- De volgende termen of frasen mag je nooit gebruiken (interne labels of cliché's): ${FORBIDDEN_TERMS.map(t => `"${t}"`).join(", ")}.

## Bronnen en actualiteit (anti-bias)
- Kennisbronnen krijg je in een vaste volgorde: verse externe bronnen > interne kennisbank > basiskennis. Behandel ze ook in die volgorde.
- Bij tegenspraak: kies de meest recente bron. Verse externe bronnen winnen altijd van basiskennis.
- Een fragment met "(mogelijk verouderd, ...)" mag je niet als hard feit brengen. Noem dan een range, verwijs door naar de externe bron, of zeg dat het verschilt per moment.
- Noem nooit interne sectienamen, peildatums of brontypes in je antwoord.

## Links
- Linkchips verschijnen automatisch onder je antwoord. Herhaal ze NOOIT in de lopende tekst.
- Gebruik een link in tekst alleen voor een specifieke externe bron (CAO-tabel, DUO-pagina) die niet als chip beschikbaar is.
- Schrijf links altijd als beschrijvend anker: [CAO-salaristabellen](https://www.vo-raad.nl/themas/arbeidsvoorwaarden-cao), nooit kale URL's.
`;

const INTENT_APPENDIX: Record<IntentType, string> = {
  greeting: `\n## Modus: Begroeting\n- Reageer warm en kort. Stel 1 open wedervraag.\n- Max 2 zinnen.`,
  question: `\n## Modus: Vraag\n- Beantwoord in max 3 zinnen. Eén kernfeit + één link + eventueel 1 vervolgvraag.\n- GEEN opsommingen of stappen.`,
  exploration: `\n## Modus: Verkenning\n- Max 2 zinnen + 1 wedervraag.`,
  followup: `\n## Modus: Vervolg\n- Max 3 zinnen. Bouw voort, geen herhaling.`,
};

// ─────────────────────────────────────────────────────────────────────
// Intent Classification
// ─────────────────────────────────────────────────────────────────────
const GREETING_RE = /^(hoi|hey|hallo|hi|goedemorgen|goedemiddag|goedenavond|welkom|dag)\b/i;
const FOLLOWUP_RE = /^(ja|nee|en|maar|ok|oke|prima|goed|dank|bedankt|thanks|klopt)\b/i;

function heuristicIntent(msg: string): IntentType {
  const trimmed = msg.trim();
  if (trimmed.length < 15 && GREETING_RE.test(trimmed)) return "greeting";
  if (trimmed.length < 25 && FOLLOWUP_RE.test(trimmed)) return "followup";
  if (trimmed.includes("?") || /\b(wat|hoe|waar|wanneer|welke|kan ik|moet ik|is het)\b/i.test(trimmed)) return "question";
  return "exploration";
}

async function classifyIntent(messages: ChatMessage[], apiKey: string): Promise<IntentType> {
  const lastMsg = [...messages].reverse().find(m => m.role === "user")?.content ?? "";
  if (!lastMsg.trim()) return "greeting";

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELS.fast,
        messages: [
          { role: "system", content: `Classificeer het laatste bericht. Antwoord ALLEEN met JSON.\nCategorieen: "greeting", "question", "exploration", "followup".\nFormaat: {"intent":"..."}` },
          ...messages.slice(-5).map(m => ({ role: m.role, content: truncateInput(m.content, 500) })),
        ],
        stream: false,
        temperature: 0,
      }),
    });

    if (!response.ok) return heuristicIntent(lastMsg);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    const match = content.match(/"intent"\s*:\s*"(\w+)"/);
    if (match && ["greeting", "question", "exploration", "followup"].includes(match[1])) {
      return match[1] as IntentType;
    }
    return heuristicIntent(lastMsg);
  } catch {
    return heuristicIntent(lastMsg);
  }
}

// ─────────────────────────────────────────────────────────────────────
// FAQ Retrieval
// ─────────────────────────────────────────────────────────────────────
interface FaqResult {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  peildatum: string | null;
  source_url: string | null;
  rank: number;
}

async function searchFaqsByFts(userMessage: string): Promise<FaqResult[]> {
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await supabase.rpc("search_faqs", {
      search_query: truncateInput(userMessage, 200),
      max_results: 10,
    });
    if (error) return [];
    return (data as FaqResult[]) || [];
  } catch {
    return [];
  }
}

async function selectBestFaqs(userMessage: string, candidates: FaqResult[], apiKey: string): Promise<FaqResult[]> {
  if (candidates.length <= 3) return candidates;

  const topRank = candidates[0]?.rank ?? 0;
  const thirdRank = candidates[2]?.rank ?? 0;
  if (topRank > 0 && thirdRank > 0 && topRank / thirdRank < 2) {
    try {
      const candidateList = candidates.map((c, i) =>
        `[${i}] Q: ${c.question}\nA: ${truncate(c.answer, 150)}`
      ).join("\n\n");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODELS.fast,
          messages: [
            { role: "system", content: `Selecteer de 3 meest relevante FAQ's. Antwoord ALLEEN met een JSON array van indices, bijv: [0, 3, 7]` },
            { role: "user", content: `Vraag: "${truncateInput(userMessage, 200)}"\n\nKandidaten:\n${candidateList}` },
          ],
          stream: false,
          temperature: 0,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim() ?? "";
        const match = content.match(/\[[\d,\s]+\]/);
        if (match) {
          const indices: number[] = JSON.parse(match[0]);
          const selected = indices.filter(i => i >= 0 && i < candidates.length).slice(0, 3).map(i => candidates[i]);
          if (selected.length > 0) return selected;
        }
      }
    } catch { /* fall through */ }
  }

  return candidates.slice(0, 3);
}

async function retrieveFaqKnowledge(userMessage: string, apiKey: string): Promise<{ fragments: string[]; sourceLinks: UiLink[]; oldestPeildatumMonths: number | null }> {
  const candidates = await searchFaqsByFts(userMessage);
  if (candidates.length === 0) return { fragments: [], sourceLinks: [], oldestPeildatumMonths: null };

  const best = await selectBestFaqs(userMessage, candidates, apiKey);

  // Hoe oud is de oudste relevante FAQ? Bepaalt of we externe verse bron willen meenemen.
  let oldestMonths: number | null = null;
  const now = new Date();
  for (const faq of best) {
    if (!faq.peildatum) continue;
    const d = new Date(faq.peildatum);
    if (Number.isNaN(d.getTime())) continue;
    const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (oldestMonths === null || months > oldestMonths) oldestMonths = months;
  }

  const fragments = best.map(faq => {
    // Provenance + leeftijd staat NIET tussen brackets (sanitizer strip die), maar in een korte voorvoeging die later weer wordt geknipt.
    let ageHint = "";
    if (faq.peildatum) {
      const d = new Date(faq.peildatum);
      if (!Number.isNaN(d.getTime())) {
        const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
        if (months >= 12) ageHint = ` (mogelijk verouderd, laatst gecheckt ${faq.peildatum})`;
      }
    }
    let entry = `${faq.question} - ${faq.answer}${ageHint}`;
    if (faq.source_url) entry += ` Meer info: [bron](${faq.source_url})`;
    return entry;
  });

  const sourceLinks: UiLink[] = best
    .filter(faq => faq.source_url)
    .slice(0, 2)
    .map(faq => ({
      label: faq.question.length > 40 ? faq.question.slice(0, 37) + "..." : faq.question,
      href: faq.source_url!,
    }));

  return { fragments, sourceLinks, oldestPeildatumMonths: oldestMonths };
}

// ─────────────────────────────────────────────────────────────────────
// SSE Stream Handler
// ─────────────────────────────────────────────────────────────────────
function replaceDashes(text: string): string {
  return text.replace(/[\u2014\u2013]/g, "-");
}

function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function resolveSystemPrompt(chatbotKey: string, fallbackPrompt: string): Promise<string> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("llm_prompt_configs")
      .select("prompt_override, active, sort_order")
      .eq("chatbot_key", chatbotKey)
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error || !data || data.length === 0) return fallbackPrompt;

    // Collect all active add-ons with non-empty overrides
    const addons = data
      .filter((row: any) => row.prompt_override?.trim())
      .map((row: any) => row.prompt_override.trim());

    if (addons.length === 0) return fallbackPrompt;

    // Append add-ons to the base prompt (never replace)
    return fallbackPrompt + "\n\n" + addons.join("\n\n");
  } catch {
    return fallbackPrompt;
  }
}

async function logPipelineEvent(
  chatbotKey: string,
  stage: string,
  severity: "info" | "warning" | "error",
  message: string,
  details: Record<string, unknown> = {},
) {
  try {
    const supabase = createAdminClient();
    await supabase.from("chatbot_pipeline_events").insert({
      chatbot_key: chatbotKey,
      stage,
      severity,
      message,
      details,
    });
  } catch {
    // Keep diagnostics non-blocking.
  }
}

// ─────────────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { messages, userPhase, userSector, detector, phase_transition } = body;
    let { profileMeta } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ── Server-side verse profile fetch ──
    // Client kan profileMeta meesturen voor latency, maar server overschrijft
    // altijd met verse DB-data zodat AI nooit op een stale snapshot werkt
    // (test net afgerond, sector net gewijzigd, fase door advisor aangepast).
    try {
      const authHeader = req.headers.get("Authorization") ?? "";
      const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (jwt) {
        const adminClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const { data: userData } = await adminClient.auth.getUser(jwt);
        const uid = userData?.user?.id;
        if (uid) {
          const { data: fresh } = await adminClient
            .from("profiles")
            .select("first_name, bio, test_completed, test_results, preferred_sector, current_phase, known_slots")
            .eq("user_id", uid)
            .maybeSingle();
          if (fresh) {
            profileMeta = {
              ...(profileMeta ?? {}),
              first_name: fresh.first_name ?? profileMeta?.first_name ?? null,
              bio: fresh.bio ?? profileMeta?.bio ?? null,
              test_completed: fresh.test_completed ?? profileMeta?.test_completed ?? null,
              test_results: (fresh.test_results as Record<string, unknown> | null) ?? profileMeta?.test_results ?? null,
              preferred_sector: fresh.preferred_sector ?? profileMeta?.preferred_sector ?? null,
              current_phase: fresh.current_phase ?? profileMeta?.current_phase ?? null,
            };
          }
        }
      }
    } catch (e) {
      console.warn("[doorai-chat] server-side profile fetch skipped:", (e as Error).message);
    }

    const phase = detector?.phase_current || userPhase || profileMeta?.current_phase || "interesseren";
    const slots = normalizeSlots(detector?.known_slots || {}, userSector || profileMeta?.preferred_sector || undefined);
    const lastUserMessage = truncateInput(
      [...messages].reverse().find(m => m.role === "user")?.content ?? "",
      2000,
    );

    // Step 1: Intent classification
    const intent = await classifyIntent(messages, LOVABLE_API_KEY);

    // Step 2: FAQ retrieval + web fallback (parallel, for non-greetings)
    let faqKnowledge: string[] = [];
    let faqSourceLinks: UiLink[] = [];
    let webKnowledge: string[] = [];

    // Always fetch trusted sources (needed for link filtering)
    const trustedSources = await fetchTrustedSources();

    if (intent !== "greeting") {
      const faqResult = await retrieveFaqKnowledge(lastUserMessage, LOVABLE_API_KEY);
      faqKnowledge = faqResult.fragments;
      faqSourceLinks = faqResult.sourceLinks;

      // Web fallback triggers — verse trusted data wint van mogelijk verouderde interne data:
      //   a) interne kennis is sparse (originele heuristiek)
      //   b) onderwerp is tijdgevoelig (salaris/cao/collegegeld/subsidie/lerarentekort/jaartal)
      //   c) oudste relevante FAQ-peildatum is >= 12 maanden oud
      const ssotKnowledge = resolveKnowledge(slots, phase, lastUserMessage);
      const TIME_SENSITIVE_RE = /\b(salaris|verdien|loon|cao|collegegeld|kosten|subsidie|lerarentekort|tekort|vacature|20\d{2})\b/i;
      const isTimeSensitive = TIME_SENSITIVE_RE.test(lastUserMessage);
      const faqIsStale = (faqResult.oldestPeildatumMonths ?? 0) >= 12;
      const sparseInternal = faqKnowledge.length + ssotKnowledge.length < 2;

      if (trustedSources.length > 0 && (sparseInternal || isTimeSensitive || faqIsStale)) {
        webKnowledge = await webFallbackSearch(lastUserMessage, trustedSources);
        console.log(`Web fallback: ${webKnowledge.length} results | sparse=${sparseInternal} timeSensitive=${isTimeSensitive} stale=${faqIsStale}`);
      }
    }

    // Step 3: Compute UI payload
    const ssotActions: UiAction[] = detector?.next_slot_key
      ? actionsForNextSlot(detector.next_slot_key, slots, phase)
      : [];

    // Build trusted domains set for link filtering
    const trustedDomains = new Set(
      trustedSources.map(s => {
        try { return new URL(s.url.startsWith("http") ? s.url : `https://${s.url}`).hostname.replace(/^www\./, ""); }
        catch { return s.url.replace(/^www\./, ""); }
      })
    );

    let uiLinks = computeLinks(phase, slots, lastUserMessage, trustedDomains);

    const existingHrefs = new Set(uiLinks.map(l => l.href));
    for (const fl of faqSourceLinks) {
      if (!existingHrefs.has(fl.href)) {
        uiLinks.push(fl);
        existingHrefs.add(fl.href);
      }
    }
    uiLinks = uiLinks.slice(0, 6);

    // Step 4: Build text links
    const textLinks = computeTextLinks(faqSourceLinks);

    // Step 5: Assemble context & system prompt
    const dynamicContext = assembleContext(
      phase, detector, profileMeta, userSector, phase_transition,
      intent, faqKnowledge, textLinks, webKnowledge, lastUserMessage,
    );
    const resolvedCorePrompt = await resolveSystemPrompt("doorai-chat", DOORAI_CORE);
    const systemPrompt = resolvedCorePrompt + INTENT_APPENDIX[intent] + `\n\n${dynamicContext}`;

    // Step 6: Non-streaming LLM call for draft validation
    const llmResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODELS.primary,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: false,
      }),
    });

    if (!llmResponse.ok) {
      const status = llmResponse.status;
      if (status === 429) {
        await logPipelineEvent("doorai-chat", "llm_call", "warning", "Rate limit from AI gateway", { status: 429 });
        return new Response(JSON.stringify({ error: "Te veel verzoeken, probeer het later opnieuw." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        await logPipelineEvent("doorai-chat", "llm_call", "error", "Credits exhausted from AI gateway", { status: 402 });
        return new Response(JSON.stringify({ error: "AI-credits zijn op, neem contact op met de beheerder." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await llmResponse.text();
      await logPipelineEvent("doorai-chat", "llm_call", "error", "AI gateway failure", {
        status,
        error: errorText.slice(0, 300),
      });
      console.error("AI gateway error:", status, errorText);
      return new Response(JSON.stringify({ error: "Er ging iets mis, probeer het opnieuw." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const llmData = await llmResponse.json();
    let draft = replaceDashes(llmData.choices?.[0]?.message?.content ?? "");

    // ── Pre-stream reflection & repair ──────────────────────────
    const REFLECTION_FORBIDDEN = [
      ...FORBIDDEN_TERMS,
      "achtergrondinformatie", "dynamische context",
    ];
    const reflectionIssues: string[] = [];
    const lowerDraft = draft.toLowerCase();

    for (const phrase of REFLECTION_FORBIDDEN) {
      if (lowerDraft.includes(phrase)) {
        reflectionIssues.push(`Bevat verboden term: "${phrase}"`);
      }
    }

    // Bracket-labels check — independent of length
    if (/\[[A-Z][^\]]{1,30}\]/.test(draft)) {
      reflectionIssues.push("Bevat bracket-labels zoals [Label]");
    }

    // Sentence length check — independent of brackets
    const intentMaxSentences: Record<string, number> = {
      greeting: 2, question: 4, exploration: 3, followup: 3,
    };
    const maxS = intentMaxSentences[intent] ?? 4;
    const sentences = draft.split(/[.!?]+/).filter(s => s.trim().length > 5);
    if (sentences.length > maxS * 1.2) {
      reflectionIssues.push(`Te lang: ${sentences.length} zinnen (max ~${maxS})`);
    }

    if (/[\u2014\u2013]/.test(draft)) {
      reflectionIssues.push("Bevat em-dash of en-dash");
    }

    // ── Repair if issues found ──────────────────────────────────
    if (reflectionIssues.length > 0) {
      await logPipelineEvent("doorai-chat", "reflection", "warning", "Draft repaired after reflection issues", {
        issues: reflectionIssues,
      });
      console.warn("Reflection issues (repairing):", reflectionIssues);

      // Strip bracket-labels inline
      draft = draft.replace(/\[[A-Z][^\]]{1,30}\]\s*/g, "");

      // Strip em/en dashes
      draft = draft.replace(/[\u2014\u2013]/g, "-");

      // If still too long after bracket removal, truncate to maxS sentences
      const repairedSentences = draft.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 5);
      if (repairedSentences.length > maxS) {
        draft = repairedSentences.slice(0, maxS).join(" ").trim();
      }

      // Remove forbidden terms by doing a second LLM call only if forbidden terms remain
      const stillHasForbidden = REFLECTION_FORBIDDEN.some(p => draft.toLowerCase().includes(p));
      if (stillHasForbidden) {
        try {
          const repairResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: MODELS.fast,
              messages: [
                { role: "system", content: `Herschrijf het volgende antwoord in maximaal ${maxS} korte zinnen. Verwijder alle verboden woorden: ${REFLECTION_FORBIDDEN.join(", ")}. Geen opsommingen, geen brackets, geen subkopjes. Alleen lopende tekst.` },
                { role: "user", content: draft },
              ],
              stream: false,
              temperature: 0.3,
            }),
          });
          if (repairResponse.ok) {
            const repairData = await repairResponse.json();
            const repaired = repairData.choices?.[0]?.message?.content?.trim();
            if (repaired && repaired.length > 10) {
              draft = replaceDashes(repaired);
            }
          }
        } catch (e) {
          console.error("Repair call failed:", e);
        }
      }
    }

    // ── Final hard-strip: forbidden terms, internal headers, verification dates,
    // scores, suffix-vormen ("oriëntatie-fase"). Idempotent; runs even when
    // reflection found no issues, to catch leaks the bare-word filter misses.
    draft = sanitizeAssistantText(draft);



    // ── Re-validate the final draft after any repairs ──────────
    const finalIssues: string[] = [];
    const finalLower = draft.toLowerCase();
    for (const phrase of REFLECTION_FORBIDDEN) {
      if (finalLower.includes(phrase)) {
        finalIssues.push(`Bevat verboden term: "${phrase}"`);
      }
    }
    if (/\[[A-Z][^\]]{1,30}\]/.test(draft)) {
      finalIssues.push("Bevat bracket-labels zoals [Label]");
    }
    const finalSentences = draft.split(/[.!?]+/).filter(s => s.trim().length > 5);
    if (finalSentences.length > maxS * 1.2) {
      finalIssues.push(`Te lang: ${finalSentences.length} zinnen (max ~${maxS})`);
    }
    if (/[\u2014\u2013]/.test(draft)) {
      finalIssues.push("Bevat em-dash of en-dash");
    }

    const reflectionPass = finalIssues.length === 0;
    const wasRepaired = reflectionIssues.length > 0 && reflectionPass;
    const reflectionPayload = JSON.stringify({
      pass: reflectionPass,
      issues: finalIssues,
      repaired: wasRepaired,
    });

    // ── Stream the validated/repaired response to client ─────────
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const enc = new TextEncoder();

    (async () => {
      try {
        // Stream the draft word-by-word for smooth UX
        const words = draft.split(/(\s+)/);
        for (const word of words) {
          const chunk = {
            choices: [{ delta: { content: word }, index: 0 }],
          };
          await writer.write(enc.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        await writer.write(enc.encode("data: [DONE]\n\n"));

        // Send reflection event
        await writer.write(enc.encode(`event: reflection\ndata: ${reflectionPayload}\n\n`));

        // Build conversation followup actions — SSOT-aware
        function buildConversationFollowups(
          phase: string,
          slots: Partial<Record<SlotKey, string>>,
          intent: IntentType,
          missingSlots: SlotKey[],
          userMsg: string,
        ): UiAction[] {
          if (intent === "greeting") return [];

          // Use shared theme mapper for consistent theme selection
          const slotsRecord: Record<string, string> = {};
          for (const [k, v] of Object.entries(slots)) {
            if (v) slotsRecord[k] = v;
          }

          // Detect what user already asked about, exclude those themes
          const currentKeys = detectCurrentThemeKeys(userMsg);

          const themes = deriveThemes({
            phase,
            knownSlots: slotsRecord,
            missingSlots,
            maxThemes: 3,
            excludeKeys: currentKeys,
          });

          // Convert themes to actions, max 2
          return themesToActions(themes, 2);
        }

        const followupActions = buildConversationFollowups(phase, slots, intent, detector?.missing_slots || [], lastUserMessage);

        // Corrected slots
        const correctedSlots: Record<string, string> = {};
        for (const [k, v] of Object.entries(slots)) {
          if (v && detector?.known_slots?.[k as SlotKey] !== v) {
            correctedSlots[k] = v;
          }
        }

        // Phase suggestion from detector
        const phaseSuggestion = detector?.phase_suggestion || undefined;

        // ── Intent-based link logic (replaces 1-op-3 rule) ──
        const LINK_REQUEST_RE = /\b(link|bron|website|url|waar vind)\b/i;
        const BRONPLICHTIG_RE = /\b(salaris|kosten|collegegeld|cao|subsidie|route|bevoegdheid|vacature|events?|open dag)\b/i;
        const shouldIncludeLinks =
          intent === "question" ||
          intent === "exploration" ||
          LINK_REQUEST_RE.test(lastUserMessage) ||
          BRONPLICHTIG_RE.test(lastUserMessage);




        const uiPayload = JSON.stringify({
          actions: followupActions,
          corrected_slots: Object.keys(correctedSlots).length > 0 ? correctedSlots : undefined,
          links: shouldIncludeLinks ? uiLinks : [],
          phase_suggestion: phaseSuggestion,
        });
        await writer.write(enc.encode(`event: ui\ndata: ${uiPayload}\n\n`));
      } catch (e) {
        console.error("Stream error:", e);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    await logPipelineEvent("doorai-chat", "handler", "error", "Unhandled doorai-chat error", {
      error: error instanceof Error ? error.message : String(error),
    });
    console.error("DoorAI error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Onbekende fout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
