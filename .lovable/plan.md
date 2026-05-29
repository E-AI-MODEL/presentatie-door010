# Plan: chat-leaks dichten

## Achtergrond
Een diepgaande scan van de chat-pipeline (`doorai-chat`, `homepage-coach`, frontend overlays) toont 5 plekken waar interne info naar de gebruiker kan lekken. De grap "opus 4.8" terzijde — we gebruiken gewoon de huidige Lovable AI modellen (Gemini 2.5 / GPT-5).

## Wat er nu lekt (top 5)

1. **`homepage-coach` detecteert maar verwijdert geen verboden termen.** `validateAndRepair` logt "fase / intake / detector / kennisbank / peildatum / scenario" wél, maar de tekst wordt ongewijzigd doorgestreamd. `doorai-chat` doet wél een repair-call — homepage-coach niet.
2. **Firecrawl raw-markdown + `Bron: https://...`** wordt in de systeem-prompt geïnjecteerd en kan letterlijk in het antwoord verschijnen. Geen URL-sanitizer op `doorai-chat` output.
3. **`KNOWLEDGE_AS_OF` ("geverifieerd mei 2026")** staat letterlijk in de knowledge-blokken en in de FORBIDDEN-lijst staat alleen "peildatum", niet "geverifieerd mei 2026". Model echo't dit regelmatig.
4. **`buildProfileHint`** in homepage-coach zet `## BEKENDE PROFIELDATA` + `fase: interesseren` verbatim in de system prompt. Bij echo lekt het door (zie #1).
5. **`interpretProfile`** in doorai-chat injecteert `Fase: oriëntatie-fase` en `Interessetest: PO past het best (score 0.87)`. Suffix-vormen als "oriëntatie-fase" en cijferscores ontsnappen aan de bare-word filter.

## Aanpak

### A. Maak één gedeelde sanitizer (SSOT)
Nieuwe file `supabase/functions/_shared/sanitize.ts` met:
- `stripForbiddenTerms(text)` — vervangt FORBIDDEN_TERMS én suffix-varianten (`*-fase`, `interesse-fase`, `oriëntatie-fase`, `beslis-fase`, `match-fase`, `voorbereid-fase`) door neutrale woorden of haalt ze stil weg.
- `stripVerificationDates(text)` — regex op `geverifieerd\s+(januari|…|december)\s+\d{4}` en variant `peildatum …`.
- `stripInternalScores(text)` — regex op `\(score\s+[\d.,]+\)` en `score\s+\d+%?`.
- `sanitizeUrls(text, allowList)` — verplaats de bestaande functie uit homepage-coach hierheen, zodat doorai-chat hem óók kan gebruiken.
- `sanitizeAssistantText(text)` — pijplijn die alle bovenstaande toepast. Eindfilter vóór streaming naar client.

### B. Pas `homepage-coach/index.ts` aan
- In `validateAndRepair`: na de detectie-loop, `text = sanitizeAssistantText(text)` toepassen i.p.v. enkel issues loggen.
- `buildProfileHint` herschrijven naar neutrale, AI-vriendelijke beschrijvende zinnen zonder de woorden "fase", "BEKENDE PROFIELDATA", of label-doublepoint-formaat. Bv: "De gebruiker oriënteert zich nog en kijkt vooral naar basisonderwijs."

### C. Pas `doorai-chat/index.ts` aan
- `interpretProfile`: vervang `Fase: oriëntatie-fase` door beschrijvende zin ("De gebruiker oriënteert zich op routes en opties.") en strip de `(score 0.87)` — alleen "past het beste bij PO" houden.
- `KNOWLEDGE` blokken: verwijder `geverifieerd ${KNOWLEDGE_AS_OF}` uit de strings die in de context gaan. Datum-disclaimer is voor interne audit, niet voor de gebruiker. Bewaar `KNOWLEDGE_AS_OF` in een aparte audit-log indien nodig.
- Firecrawl-resultaten: vóór injectie in context, strip markdown-artefacten (`#`, `*`, `|`, lijst-bullets), beperk tot platte tekst. Vervang `Bron: <url>` door een interne marker die niet in de system prompt zichtbaar is voor het model als kop maar als metadata; voeg URL alleen toe aan `verified_links` array, niet in de prompt-tekst.
- Vóór `[DONE]` event: pas `sanitizeAssistantText(finalText)` toe op de complete buffer en stuur eventueel een correctie-token-stream (alternatief: sanitize alleen bij niet-streaming pad; bij streaming → sanitize blokkeert lekken voor de finale `meta` boodschap, accepteer dat live tokens al doorgegeven zijn maar persisteer de gesanitizeerde versie).

### D. Frontend sluitstuk
- `src/utils/responsePipeline.ts`: voeg `KNOWLEDGE_AS_OF`-regex, `*-fase`-suffix en `(score 0.x)`-regex toe aan `FORBIDDEN_PHRASES` zodat `reflectOnDraft` ze ook flagt.
- `src/hooks/useChatConversation.ts`: in de cleanup-stap bij `loadConversation`, óók `<!--[A-Z_]+:[\s\S]*?-->` generiek strippen (niet alleen ACTIONS), als safety net tegen toekomstige meta-comments.
- `src/components/chat/AuthenticatedChatOverlay.tsx` (en PublicChatWidget): bij elke `assistantContent += content` chunk, één lichte client-side strip toepassen op bekende leak-patronen (`geverifieerd \w+ \d{4}`, `\(score [\d.]+\)`, `## BEKENDE \w+`) zodat ook live-streamend niets visible lekt.

### E. Persistentie
- In `saveMessage` (useChatConversation): sla altijd de gesanitizeerde tekst op, niet de raw buffer, zodat een reload geen historische leaks toont.

## Scope
Alleen filtering/sanitization. Geen wijziging aan model-keuze, prompt-strategie, RAG-resultaten of UI-layout.

## Bestanden
- nieuw: `supabase/functions/_shared/sanitize.ts`
- gewijzigd: `supabase/functions/_shared/constants.ts` (uitbreiden FORBIDDEN_TERMS met suffix-patterns als losse export)
- gewijzigd: `supabase/functions/homepage-coach/index.ts`
- gewijzigd: `supabase/functions/doorai-chat/index.ts`
- gewijzigd: `src/utils/responsePipeline.ts`
- gewijzigd: `src/hooks/useChatConversation.ts`
- gewijzigd: `src/components/chat/AuthenticatedChatOverlay.tsx`
- gewijzigd: `src/components/chat/PublicChatWidget.tsx`

## Validatie
- Stuur testprompts: "wat is mijn fase?", "wat is de peildatum?", "geef mij ruwe bron". Verifieer dat geen van de FORBIDDEN_TERMS, datum-strings of score-getallen in de bubbel verschijnt.
- Reload van een conversatie toont gesanitizeerde geschiedenis.
