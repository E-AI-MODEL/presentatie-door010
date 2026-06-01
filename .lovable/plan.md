# Plan: stop padlekken zoals "(/opleidingen)" in AI-tekst — definitief

## Wat ik vond (root cause)

Het lek `(/opleidingen)` is geen toeval. Drie elkaar versterkende oorzaken:

1. **De prompts vertonen het foute gedrag zelf** — bias door voorbeelden
   - `supabase/functions/doorai-chat/index.ts` regel 683:
     `Voorbeeld: [Routes bekijken](/opleidingen)`
   - `supabase/functions/homepage-coach/index.ts` regels 343–365 staan vol met:
     `[/opleidingen](/opleidingen)`, `[/vacatures](/vacatures)` —
     het pad wordt letterlijk als label gebruikt.
   - Gevolg: het model imiteert en schrijft `(/opleidingen)` of `/opleidingen` los in de prose.

2. **Tegenstrijdige instructie**
   - Regel 707–708 zegt: *"Linkchips verschijnen automatisch. Herhaal ze NOOIT."*
   - Maar regel 681–683 zegt: *"Gebruik max 2 markdown-links per antwoord."*
   - Het model kiest de makkelijkste weg en plakt het pad ergens neer.

3. **Sanitizers vangen dit niet af**
   - `supabase/functions/_shared/sanitize.ts` en `src/utils/sanitizeClient.ts` strippen
     forbidden terms, peildatums, scores en niet-whitelisted URL's — maar geen **interne
     paden** (`/opleidingen`, `/vacatures`, `/events`, `/kennisbank`, `/profile`, `/dashboard`).
   - Ook geen `[/pad](/pad)` markdown-link waarbij label = pad.

## Andere plekken waar dit ook gebeurt (of kan gebeuren)

Geïdentificeerde patronen die nu door de mazen glippen:

- `(/opleidingen)` — parenthetische verwijzing in prose
- `op /opleidingen`, `via /vacatures` — losse pad-mentions
- `[/opleidingen](/opleidingen)` — label = pad markdown
- `[opleidingen](/opleidingen)` met label dat alleen het slug-woord is
- Onder bijv. salaris/CAO-vragen kan het model zomaar `(/kennisbank)` of `(/profile)` als
  parenthetische verwijzing opnemen omdat de prompt zegt "gebruik markdown-links".
- `homepage-coach` heeft dezelfde patronen → zelfde lek mogelijk op de publieke widget.
- Backoffice/advisor-flows raken het niet (geen end-user prose), maar dezelfde sanitize
  pipeline draait er wel doorheen — geen risico op extra lek, wel reden om sanitizer
  centraal te repareren.

## Oplossing — drielaags (prompt + sanitizer server + sanitizer client)

### Laag 1: prompt bias verwijderen (oorzaak wegnemen)

Beide edge functions:
- Voorbeelden met `[/opleidingen](/opleidingen)` of `[Routes bekijken](/opleidingen)`
  uit het systeem-prompt **schrappen**. Het model leert nu dat paden zichtbaar mogen zijn.
- Vervangen door één duidelijke regel:
  > "Schrijf nooit URL-paden (`/opleidingen`, `/vacatures`, etc.) als zichtbare tekst.
  > Geen `(/pad)`, geen `/pad` los in de zin, geen `[label](/pad)`. De chips onder je
  > antwoord doen dat al."
- In `homepage-coach` de hele markdown-tabel met `[/opleidingen](/opleidingen)` herschrijven
  zonder enige interne padverwijzing — daar komen chips voor.
- Bestaande regel "Linkchips verschijnen automatisch ... Herhaal ze NOOIT" upgraden van
  zachte naar harde regel onder `## Verboden`.

### Laag 2: sanitizer server-side (laatste vangnet)

Uitbreiden in `supabase/functions/_shared/sanitize.ts`:

```text
INTERNAL_PATHS = ["opleidingen","vacatures","events","kennisbank","profile",
                  "dashboard","backoffice","auth"]

- strip pattern: \s*\(\s*/(opleidingen|vacatures|…)\b[^)]*\)   → ""
- strip pattern: \s+/(opleidingen|vacatures|…)\b               → ""
- rewrite [/pad](/pad)              → ""  (label was leeg/identiek aan pad)
- rewrite [opleidingen](/opleidingen) (label === slug)         → ""
- behoud:  [Routes bekijken](/opleidingen) (label != slug)     blijft staan
```

Aan einde van `sanitizeAssistantText` toevoegen vóór de cleanup-pass, zodat dubbele spaties
en hangende leestekens opgeruimd worden door de bestaande tail.

### Laag 3: sanitizer client-side (extra net rond stream)

Zelfde 4 regels mirroren in `src/utils/sanitizeClient.ts`. Houdt SSE-stream-edge-gevallen
en oude opgeslagen berichten ook schoon bij re-render.

### Laag 4: validator-trigger voor reflectie-loop

In `src/utils/responsePipeline.ts` en de `REFLECTION_FORBIDDEN`-check in `doorai-chat`
(rond regel 1072–1170): patroon `\(/[a-z-]+\)` toevoegen aan `FORBIDDEN_PATTERNS`. Zo
triggert het bestaande "rewrite via LLM" mechanisme als toch een lek door alle filters komt
— in plaats van het lek aan de gebruiker tonen.

## Bestanden

- `supabase/functions/doorai-chat/index.ts` — prompt opschonen + REFLECTION-pattern
- `supabase/functions/homepage-coach/index.ts` — prompt opschonen (tabel, voorbeelden)
- `supabase/functions/_shared/sanitize.ts` — INTERNAL_PATHS strip + label==pad rewrite
- `src/utils/sanitizeClient.ts` — mirror van die strip
- `src/utils/responsePipeline.ts` — `\(/[a-z-]+\)` aan FORBIDDEN_PATTERNS

## Wat NIET verandert

- Linkchips (de groene/witte pillen) blijven werken — die komen via `actions`/`primary_followup`
  metadata, niet via prose.
- Bestaande whitelist-URL logica blijft intact (CAO, DUO etc.).
- Geen UI-wijzigingen.

## Validatie achteraf

- `supabase--curl_edge_functions` op `/doorai-chat` met vraag "Welke routes zijn er om
  leraar te worden?" en checken dat geen `/opleidingen`, `(/opleidingen)` of `[/x](/x)`
  in `directAnswer` of `supportingDetail` zit.
- Idem op `/homepage-coach`.
- Visuele check in preview.
