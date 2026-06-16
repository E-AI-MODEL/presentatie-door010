## Wat ik zag

In je screenshot:
- De AI-bubble heeft de standaard grijze `bg-muted` — er is geen ambient kleur-indicator op basis van begripszekerheid, terwijl in core-memory staat dat de laatste AI-bubble een tint moet krijgen (amber <0.55, groen-licht 0.55-0.74, neutraal ≥0.75).
- De vervolgvraag-chips ("Routes", "Verdienen") zijn felgroen `bg-primary` met witte tekst en tonen alleen een topic-keyword — geen echte micro-vraag, en visueel even prominent als jouw eigen verzonden bericht.

## Wijzigingen

### 1. Ambient zekerheids-tint op laatste AI-bubble
**Bestand:** `src/components/chat/AuthenticatedChatOverlayV3.tsx` (renderlus rond regel 463-475)

- Bepaal index van laatste assistant-message en lees `message.structured?.meta?.confidence` (of het confidence-veld dat al in turn-meta zit).
- Vervang de hardcoded `bg-muted` klasse op alleen die laatste bubble door een tint-tabel:
  - `< 0.55` → zachte amber tint (`bg-amber-50 dark:bg-amber-950/20 border-amber-200/40`)
  - `0.55 – 0.74` → licht-groen (`bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/40`)
  - `≥ 0.75` of `undefined` → huidige neutrale `bg-muted`
- Subtiel, géén harde rand of badge — puur achtergrond-tint zoals afgesproken.
- Oudere AI-bubbles blijven neutraal (anders wordt de chat te druk).

### 2. Subtielere chips als échte micro-vraag
**Bestanden:** `src/components/chat/ChatTurnArtifacts.tsx` + label-generatie server-side

**Visueel (`QuestionButton`, regel 89-105):**
- Weg met `bg-primary text-primary-foreground`.
- Nieuw: ghost-stijl, `bg-transparent border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-full`.
- Icoon `MessageCircleQuestion` blijft maar lichter (`opacity-50`).
- Geen `max-w-[220px]` truncate: laat hele micro-vraag zien (max ~60 tekens), wrap toegestaan.
- Plaats chips iets onder de bubble met meer `mt-3` zodat ze los van de antwoord-tekst hangen.

**Inhoud (server, `supabase/functions/doorai-chat/index.ts` waar `actions`/questions worden gevormd):**
- Huidige labels zijn topic-keywords ("Routes", "Verdienen"). Pas de prompt/builder aan zodat elk question-artifact een korte, concrete vervolgvraag is in de ik-vorm of jij-vorm, max ~8 woorden, geen hoofdletter-keyword. Voorbeelden:
  - i.p.v. "Verdienen" → "Wat verdient een startende leraar?"
  - i.p.v. "Routes" → "Welke routes passen bij jou?"
- Behoud limiet van 2 question-chips (core memory) en 2 link-chips.
- Sanitizer/forbidden-terms-lijst blijft gerespecteerd; labels mogen geen verboden termen of interne paden bevatten.

### 3. Verificatie
- Preview op `/dashboard` openen, persoonlijke chat starten, dezelfde vraag stellen.
- Controleren: bubble heeft amber/groen-licht/neutraal afhankelijk van confidence; chips zijn outline-stijl met volzin-micro-vragen.

## Technische notitie
- Confidence is al beschikbaar via `turn_meta` events (`src/utils/chatTurnArtifacts.ts` regel 188-223 toont dat het al uit meta gelezen wordt voor de StatusLine). We hergebruiken dezelfde waarde — geen nieuwe SSE-velden nodig.
- Geen wijzigingen aan phase detector, RAG of orchestratie. Alleen UI + label-tekstgeneratie.
