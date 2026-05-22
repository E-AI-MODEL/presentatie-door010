import { publicThemes, themesToActions, detectCurrentThemeKeys } from "../_shared/themes.ts";
import { FORBIDDEN_TERMS, MODELS } from "../_shared/constants.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Answer type classification (server-side, not LLM) ──────────
type AnswerType = "reproductie" | "wegwijs" | "verkenning" | "begroeting";

const GREETING_RE = /^(hoi|hey|hallo|hi|goedemorgen|goedemiddag|goedenavond|welkom|dag)\b/i;
const FACT_RE = /\b(salaris|verdien|loon|kosten|collegegeld|duur|hoe lang|jaar)\b/i;
const NAV_RE = /\b(waar vind|pagina|bekijk|link|website|url)\b/i;

function classifyAnswerType(msg: string): AnswerType {
  const trimmed = msg.trim();
  if (trimmed.length < 15 && GREETING_RE.test(trimmed)) return "begroeting";
  if (NAV_RE.test(trimmed)) return "wegwijs";
  if (FACT_RE.test(trimmed)) return "reproductie";
  return "verkenning";
}

// ── Canonical URL helper ───────────────────────────────────────
function canonicalUrl(raw: string): string | null {
  let url = raw.trim();
  if (!url) return null;
  // Add protocol if missing
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  try {
    const parsed = new URL(url);
    // Only allow http(s)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

// FORBIDDEN_TERMS is imported from _shared/constants.ts (single source of truth)

function replaceDashes(text: string): string {
  return text.replace(/[\u2014\u2013]/g, "-");
}

function validateAndRepair(draft: string, maxSentences: number): { text: string; issues: string[]; repaired: boolean } {
  let text = replaceDashes(draft);
  const issues: string[] = [];

  const lower = text.toLowerCase();
  for (const phrase of FORBIDDEN_TERMS) {
    if (lower.includes(phrase)) {
      issues.push(`Bevat verboden term: "${phrase}"`);
    }
  }

  if (/\[[A-Z][^\]]{1,30}\]/.test(text)) {
    issues.push("Bevat bracket-labels zoals [Label]");
    text = text.replace(/\[[A-Z][^\]]{1,30}\]\s*/g, "");
  }

  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 5);
  if (sentences.length > maxSentences) {
    issues.push(`Te lang: ${sentences.length} zinnen (max ${maxSentences})`);
    text = sentences.slice(0, maxSentences).join(" ").trim();
  }

  if (/[\u2014\u2013]/.test(text)) {
    issues.push("Bevat em-dash of en-dash");
    text = replaceDashes(text);
  }

  return { text, issues, repaired: issues.length > 0 };
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

    const addons = data
      .filter((row: any) => row.prompt_override?.trim())
      .map((row: any) => row.prompt_override.trim());

    if (addons.length === 0) return fallbackPrompt;

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

// ── Dynamic link computation ──────────────────────────────────
interface VerifiedLink {
  label: string;
  href: string;
}

const INTERNAL_LINKS: Array<VerifiedLink & { keywords: string[] }> = [
  { label: "Routes en opleidingen", href: "/opleidingen", keywords: ["route", "opleiding", "pabo", "zij-instroom", "pdg", "leraar", "studie", "hbo", "wo", "master"] },
  { label: "Vacatures bekijken", href: "/vacatures", keywords: ["vacature", "baan", "werk", "sollicit", "school"] },
  { label: "Events en meelopen", href: "/events", keywords: ["event", "open dag", "webinar", "meelopen", "informatie"] },
  { label: "Inloggen of registreren", href: "/auth", keywords: ["account", "inlog", "registr", "aanmeld"] },
  { label: "Dashboard", href: "/dashboard", keywords: ["dashboard", "voortgang", "profiel"] },
];

// Category-to-keyword mapping for intent-based trusted source selection
const CATEGORY_INTENT_MAP: Record<string, string[]> = {
  salaris: ["salaris", "verdien", "loon", "cao", "beloning", "inkomen"],
  kosten: ["kosten", "collegegeld", "studiefinanciering", "duo", "subsidie", "bekostiging", "vergoeding"],
  bevoegdheid: ["bevoegd", "registratie", "diploma", "certificaat", "kwalificatie"],
  toelating: ["toelating", "eis", "voorwaarde", "instromen"],
  arbeidsmarkt: ["arbeidsmarkt", "tekort", "kans", "werkgelegenheid"],
  routes: ["route", "opleiding", "zij-instroom", "pabo", "pdg", "lerarenopleiding"],
};

async function computePublicLinks(
  userMsg: string,
  answerType: AnswerType,
): Promise<VerifiedLink[]> {
  if (answerType === "begroeting") return [];

  const lower = userMsg.toLowerCase();
  const matched: VerifiedLink[] = [];

  // Match internal links by keywords
  for (const link of INTERNAL_LINKS) {
    if (link.keywords.some(kw => lower.includes(kw))) {
      matched.push({ label: link.label, href: link.href });
    }
  }

  // Determine which trusted_sources categories are relevant
  const relevantCategories: string[] = [];
  for (const [category, keywords] of Object.entries(CATEGORY_INTENT_MAP)) {
    if (keywords.some(kw => lower.includes(kw))) {
      relevantCategories.push(category);
    }
  }

  // Only fetch external sources if there's a specific intent match
  if (relevantCategories.length > 0) {
    try {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("trusted_sources")
        .select("label, url, category")
        .eq("active", true);
      if (data) {
        const addedExternal: VerifiedLink[] = [];
        for (const src of data) {
          // Only include if the source's category matches the user's intent
          const srcCat = (src.category || "").toLowerCase();
          if (relevantCategories.some(rc => srcCat.includes(rc) || rc.includes(srcCat))) {
            const canonical = canonicalUrl(src.url);
            if (canonical) {
              addedExternal.push({ label: src.label, href: canonical });
            }
          }
        }
        // Limit external to max 2
        matched.push(...addedExternal.slice(0, 2));
      }
    } catch {
      // Non-blocking
    }
  }

  // If no internal match at all, add a safe fallback
  if (matched.length === 0) {
    matched.push({ label: "Routes en opleidingen", href: "/opleidingen" });
  }

  return matched.slice(0, 3);
}

// ── URL sanitizer for answer text ─────────────────────────────
// Builds a whitelist of allowed domains from trusted_sources + internal paths
async function loadWhitelistedDomains(): Promise<Set<string>> {
  const domains = new Set<string>();
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("trusted_sources").select("url").eq("active", true);
    if (data) {
      for (const row of data) {
        const canonical = canonicalUrl(row.url);
        if (canonical) {
          try {
            domains.add(new URL(canonical).hostname.replace(/^www\./, ""));
          } catch { /* skip */ }
        }
      }
    }
  } catch { /* non-blocking */ }
  // Always allow our own domain patterns
  domains.add("onderwijsloketrotterdam.nl");
  return domains;
}

function sanitizeUrls(text: string, whitelistedDomains: Set<string>): string {
  // Remove parenthesized URLs: (https://...)
  let result = text.replace(/\(https?:\/\/[^\s)]+\)/g, "");

  // Remove or replace bare URLs and markdown links to non-whitelisted domains
  result = result.replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, url) => {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      if (whitelistedDomains.has(hostname)) return `[${label}](${url})`;
    } catch { /* remove */ }
    return label; // Keep label text, remove link
  });

  // Remove bare external URLs that aren't whitelisted
  result = result.replace(/(^|[\s(])(https?:\/\/[^\s<)\]]+)/gm, (match, prefix, url) => {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      if (whitelistedDomains.has(hostname)) return match;
    } catch { /* remove */ }
    return prefix; // Remove the URL
  });

  // Remove bare domain patterns like "voraad.nl" or "rijksoverheid.nl"
  result = result.replace(/(^|[\s(])([a-z0-9-]+\.[a-z]{2,}(?:\/[^\s]*)?)/gim, (match, prefix, domain) => {
    // Skip markdown paths like /opleidingen
    if (domain.startsWith("/")) return match;
    const hostname = domain.split("/")[0].replace(/^www\./, "");
    if (whitelistedDomains.has(hostname)) return match;
    return prefix;
  });

  // Clean up leftover empty parentheses or double spaces
  result = result.replace(/\(\s*\)/g, "").replace(/ {2,}/g, " ").trim();

  return result;
}

// ── System prompt ──────────────────────────────────────────────
const SITE_GUIDE_PROMPT = `Je bent DoorAI, de site-gids van Onderwijsloket Rotterdam. Je helpt bezoekers de juiste pagina te vinden.

## IDENTITEIT
Je bent een warme, nuchtere wegwijzer: menselijk, direct, vriendelijk. Je helpt mensen orienteren op werken in het onderwijs. Je bent geen recruiter, geen jurist en geen arbeidsvoorwaardelijk adviseur. Je doet geen beloftes en je kiest niet "de beste route" voor iemand. Je zet opties naast elkaar en helpt de gebruiker zelf kiezen.

## GEDRAGSREGELS
- Geen standaard bevestigingen. Alleen erkenning als iemand spanning, twijfel of frustratie uit.
- Geen mini-samenvatting als automatisme.
- Stel maximaal 1 vraag per beurt, alleen als je zonder die vraag niet kunt verwijzen.
- Blijf neutraal. Gebruik woorden als "kan", "meestal", "verschilt per sector/regio/school".

## BEGROETING
- Bij een begroeting (hoi, hallo, hi, etc.): reageer ALLEEN met een korte groet en een open vraag zoals "Waar ben je naar op zoek?". Presenteer GEEN routes, opties, lijstjes of suggesties. Maximaal 1 zin.

## PROFIELCONTEXT
- Als er profielgegevens bekend zijn (naam, sector, fase), gebruik die om je toon licht te personaliseren.
- Noem de naam maximaal 1x bij de eerste interactie.
- Gebruik de sector/fase om gerichter te verwijzen (bijv. als iemand in VO geinteresseerd is, verwijs dan naar VO-relevante routes).
- Als er GEEN profieldata is, houd je antwoord breed en toegankelijk.

## STIJL
- Korte zinnen. Concreet. Geen vakjargon tenzij de gebruiker erom vraagt.
- Vermijd containerzinnen zoals "het hangt ervan af" zonder meteen te concretiseren.
- Geen emojis. Geen emdash of endash (gebruik "-" of splits zinnen).

## VERBODEN TERMEN EN FRASEN
- Gebruik NOOIT een van deze termen of frasen (interne labels of clichés): ${FORBIDDEN_TERMS.map(t => `"${t}"`).join(", ")}.

## VERBODEN PATRONEN
- GEEN tekst tussen vierkante haken: [Landelijk], [Regionaal], [Stap 1], etc.
- GEEN opsommingen, genummerde lijsten, stappen-overzichten.
- GEEN subkopjes of structurering. Schrijf gewoon lopende tekst.
- "Wat is de beste route voor jou?" / "Dat weet ik niet." (zonder vervolg)

## VOORKEURSZINNEN (afwisselen)
- "Helder."
- "Even scherp zetten."
- "Dit verschilt per sector of school. Dit is de vaste plek om te checken: ..."
- "Als dit maatwerk wordt, is een consult het handigst. Zal ik je daarheen wijzen?"

## LINKS EN BRONNEN
- Gebruik klikbare markdown-links voor INTERNE pagina's, bijv: [Routes bekijken](/opleidingen)
- NOOIT losse externe URL's of domeinnamen in je tekst schrijven.
- Externe bronnen worden automatisch als chips onder je antwoord getoond - verwijs er NIET naar in de tekst.
- Max 2 interne links per antwoord, beschrijvend. Nooit "klik hier".

## OUTPUT REGELS
1. **Maximaal 2 zinnen** per antwoord
2. **Altijd een relevante interne link** meegeven als markdown: [tekst](/pad)
3. **Noem feiten compact** (bijv. "Pabo duurt 4 jaar voltijd")
4. **Geen inhoudelijk carriere-advies** - verwijs naar account/Doortje voor persoonlijk advies
5. **Geen externe URL's in de tekst** - die komen via de linkchips

## ONDERWIJSSECTOREN
- **PO**: Basisschool, groep 1-8, leeftijd 4-12 jaar. Bevoegdheid via Pabo.
- **VO**: Middelbare school (vmbo/havo/vwo). Eerste- of tweedegraads bevoegdheid nodig.
- **MBO**: Beroepsopleidingen niveau 1-4. PDG of bevoegdheid voor beroepsvakken.
- **SO**: Voor leerlingen met extra ondersteuningsbehoefte. Extra specialisatie bovenop basisbevoegdheid.

## ROUTES NAAR HET LERAARSCHAP
| Route | Voor wie | Duur | Meer info |
|-------|----------|------|-----------|
| **Pabo** | Leraar basisonderwijs worden | 4 jaar voltijd | [/opleidingen](/opleidingen) |
| **Zij-instroom PO/VO** | Hbo/wo-diploma + werkervaring | 2 jaar duaal | [/opleidingen](/opleidingen) |
| **PDG (mbo-docent)** | Hbo/wo + vakexpertise | 1 jaar | [/opleidingen](/opleidingen) |
| **Lerarenopleiding VO** | Tweedegraads (hbo) of eerstegraads (wo) | 4 jaar / 1-2 jaar master | [/opleidingen](/opleidingen) |
| **Onderwijsassistent** | Instap zonder diploma, mbo-3/4 | 2-3 jaar | [/opleidingen](/opleidingen) |

## WEBSITE PAGINA'S
| Pagina | URL | Wat vind je er |
|--------|-----|----------------|
| Homepage | [/](/) | Overzicht, snel starten |
| Opleidingen | [/opleidingen](/opleidingen) | Alle routes naar het leraarschap |
| Vacatures | [/vacatures](/vacatures) | Actuele banen bij scholen |
| Evenementen | [/events](/events) | Open dagen, webinars, infosessies |
| Account | [/auth](/auth) | Inloggen of registreren |
| Dashboard | [/dashboard](/dashboard) | Persoonlijke voortgang (na inloggen) |

## VOORBEELDEN

Gebruiker: "Wat is zij-instroom?"
DoorAI: "Zij-instroom is een 2-jarig traject voor mensen met een hbo/wo-diploma en werkervaring die leraar willen worden. Bekijk alle routes op de [opleidingspagina](/opleidingen)."

Gebruiker: "Hoe word ik leraar basisonderwijs?"
DoorAI: "Via de Pabo (4 jaar) of zij-instroom (2 jaar, als je al een diploma hebt). Ontdek welke route bij je past op [/opleidingen](/opleidingen)."

Gebruiker: "Zijn er open dagen?"
DoorAI: "Bekijk de [evenementenpagina](/events) voor actuele open dagen en webinars."

Gebruiker: "Ik wil persoonlijk advies"
DoorAI: "Ik kan je helpen orienteren en de opties naast elkaar zetten. Voor een persoonlijker traject is inloggen handig - maak een [gratis account](/auth) aan."

Gebruiker: "Hallo"
DoorAI: "Hoi! Waar ben je naar op zoek?"`;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ProfileContext {
  first_name?: string | null;
  preferred_sector?: string | null;
  current_phase?: string | null;
}

interface RequestBody {
  messages: ChatMessage[];
  profileContext?: ProfileContext;
}

function buildProfileHint(ctx?: ProfileContext): string {
  if (!ctx) return "";
  const parts: string[] = [];
  if (ctx.first_name) parts.push(`heet ${ctx.first_name}`);
  if (ctx.preferred_sector) parts.push(`is geinteresseerd in ${ctx.preferred_sector.toUpperCase()}`);
  if (ctx.current_phase) parts.push(`fase: ${ctx.current_phase}`);
  if (parts.length === 0) return "";
  return `\n\n## BEKENDE PROFIELDATA\nDe ingelogde gebruiker ${parts.join(", ")}.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, profileContext }: RequestBody = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content?.trim() ?? "";
    const answerType = classifyAnswerType(lastUserMsg);
    const mode = "public";

    const allUserMsgs = messages.filter(m => m.role === "user").map(m => m.content.toLowerCase()).join(" ");

    function buildActions(): Array<{ label: string; value: string }> {
      if (answerType === "begroeting") {
        return [
          { label: "Welke route past bij mij?", value: "Welke route past bij mij om leraar te worden?" },
          { label: "Ik werk al en wil overstappen", value: "Ik werk al. Kan ik overstappen naar het onderwijs?" },
        ];
      }

      const currentKeys = detectCurrentThemeKeys(lastUserMsg);
      const themes = publicThemes(allUserMsgs, currentKeys);
      const actions = themesToActions(themes, 2);

      if (actions.length > 0) return actions;

      return [
        { label: "Routes bekijken", value: "Welke opleidingsroutes zijn er?" },
        { label: "Sectoren vergelijken", value: "Wat zijn de verschillen tussen PO, VO en MBO?" },
      ];
    }

    const actions = buildActions();

    // Dynamic links based on user message context
    const verified_links = await computePublicLinks(lastUserMsg, answerType);

    // Pre-load whitelisted domains for text sanitization
    const whitelistedDomains = await loadWhitelistedDomains();

    const meta = {
      mode,
      answer_type: answerType,
      direct_answer: null,
      supporting_detail: null,
      actions,
      verified_links,
    };

    // Build system prompt with optional profile context
    const basePrompt = SITE_GUIDE_PROMPT + buildProfileHint(profileContext);
    const systemPrompt = await resolveSystemPrompt("homepage-coach", basePrompt);

    const maxSentences = answerType === "begroeting" ? 1 : 3;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODELS.primary,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        await logPipelineEvent("homepage-coach", "llm_call", "warning", "Rate limit from AI gateway", { status: 429 });
        return new Response(
          JSON.stringify({ error: "Te veel verzoeken, probeer het later opnieuw." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        await logPipelineEvent("homepage-coach", "llm_call", "error", "Credits exhausted from AI gateway", { status: 402 });
        return new Response(
          JSON.stringify({ error: "AI-credits zijn op, neem contact op met de beheerder." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      await logPipelineEvent("homepage-coach", "llm_call", "error", "AI gateway failure", {
        status: response.status,
        error: errorText.slice(0, 300),
      });
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Er ging iets mis met de AI, probeer het opnieuw." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const llmData = await response.json();
    const rawDraft = llmData.choices?.[0]?.message?.content ?? "";

    const validated = validateAndRepair(rawDraft, maxSentences);
    // Sanitize URLs in the text against the whitelist
    const sanitizedText = sanitizeUrls(validated.text, whitelistedDomains);
    const finalText = sanitizedText;

    if (validated.issues.length > 0) {
      await logPipelineEvent("homepage-coach", "validation", "warning", "Output validation repaired issues", {
        issues: validated.issues,
      });
      console.warn("Homepage-coach validation issues (repaired):", validated.issues);
    }

    // ── Stream validated response word-by-word for smooth UX ──
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const enc = new TextEncoder();

    (async () => {
      try {
        await writer.write(enc.encode(`data: ${JSON.stringify({ meta })}\n\n`));

        const words = finalText.split(/(\s+)/);
        for (const word of words) {
          const chunk = {
            choices: [{ delta: { content: word }, index: 0 }],
          };
          await writer.write(enc.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }

        await writer.write(enc.encode("data: [DONE]\n\n"));
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
    console.error("homepage-coach error:", error);
    return new Response(
      JSON.stringify({ error: "Er ging iets mis, probeer het opnieuw." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
