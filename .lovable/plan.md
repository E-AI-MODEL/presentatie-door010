# Herstelplan: verloren functies in persoonlijke chat

Op basis van de deepdive zijn er 4 echte regressies + 1 false alarm. Aanpak: 5 stappen, elk met een harde exit-voorwaarde voordat ik doorga.

---

## Stap 1 — Topic/burger-menu zichtbaar in de persoonlijke chat

**Probleem:** In `AuthenticatedChatOverlay.tsx:70` staat `showTopicPanel = useState(false)`. Het menu bestaat nog (regels 785–819), maar zit verstopt achter een toggle. Voor de demo voelt het als "weg".

**Fix:**
- Default openen: `useState(true)` zodra de overlay opent in persoonlijke modus.
- Burger-icoon blijft zichtbaar als sluit/open-knop.

**Exit-voorwaarde:** Bij openen van de persoonlijke chat is het persoonlijke topic-menu direct zichtbaar (zonder extra klik). Burger-icoon werkt nog steeds als toggle.

---

## Stap 2 — Doorklikken/chips komen weer betrouwbaar door (Router-fix)

**Probleem:** `conversationRouter.ts:41` zet de modus op `"clarify"` zodra het antwoord ≤2 zinnen is én er (toevallig) geen action/link is. In `"clarify"` én `"phase_transition"` worden ALLE chips verborgen, óók wanneer er wél een action of link is teruggekomen.

**Fix:**
- Render-gate in `AuthenticatedChatOverlay.tsx`: als `currentActions.length > 0` of `currentLinks.length > 0` → altijd tonen, ongeacht `mode`.
- `conversationRouter.ts:41`: alleen "clarify" als er ook écht 0 chips zijn.

**Exit-voorwaarde:** Bij een kort antwoord met 1 action/link verschijnt die chip altijd. Bij phase-transition met link verschijnt de link-chip. Geverifieerd via live-test in preview met een korte vraag.

---

## Stap 3 — Sanitizer stript geen legitieme link-labels meer

**Probleem:** `FORBIDDEN_BARE` in `sanitizeClient.ts:23` en `_shared/sanitize.ts` bevat `"kennisbank"` en `"slot"`. Word-boundary replace strikt deze ook in `[Kennisbank](/kennisbank)` → leeg label, en `"slot"` botst met normaal Nederlands.

**Fix:**
- `slot` verwijderen uit `FORBIDDEN_BARE` (te generiek). Vervangen door specifieke compound `known_slots`/`slot_key` indien nodig.
- Replace alleen toepassen op text-segmenten buiten markdown-anchor `[...]`. Bracket-inhoud overslaan via split-en-rejoin op markdown-link-regex.
- Zelfde aanpak in server-side `_shared/sanitize.ts`.

**Exit-voorwaarde:** `[Kennisbank](/kennisbank)` blijft intact in render. Zin "slot van de avond" blijft intact. Forbidden bare woorden (fase, intake, scenario, detector) buiten link-labels worden nog wel geneutraliseerd.

---

## Stap 4 — Chip-limiet ophogen naar 2 zodat demo niet "leeg" voelt

**Probleem:** `.slice(0, 1)` op zowel action- als link-chips in `AuthenticatedChatOverlay.tsx` (regels ~365/369/420/421), `PublicChatWidget.tsx`, `doorai-chat/index.ts:1061`, `homepage-coach/index.ts:541/545`. Bij greetings/phase-transition is dat ene slot vaak leeg → niets klikbaar.

**Fix:** Limiet ophogen naar `slice(0, 2)` op alle 6 locaties. Memory-regel "max 1 action chip, 1 link chip" wordt aangepast naar "max 2 action chips, 2 link chips".

**Exit-voorwaarde:** In live preview tonen normale turns 1–2 action-chips én 1–2 link-chips. Layout breekt niet (chips wrap netjes).

---

## Stap 5 — Live smoke-test in de preview

Met `admin010` inloggen via browser-preview en testen:
1. Dashboard → "Stel vraag" op een topic → chat opent met topic-menu zichtbaar (Stap 1).
2. Korte vraag stellen → chip(s) verschijnen en zijn klikbaar (Stap 2 + 4).
3. Link-chip klikken → navigeert naar `/opleidingen` of `/kennisbank` (Stap 2).
4. Antwoord met `[Kennisbank](/kennisbank)` in tekst → label staat er nog (Stap 3).
5. Burger-icoon klikt menu dicht/open.

**Exit-voorwaarde:** Alle 5 testen slagen. Geen console-errors. Pas dan klaarmelden.

---

## Niet aangeraakt (bewust)

- `Dashboard.tsx` → `AuthenticatedChatOverlay` handoff via `doorai-send-message` event werkt nog correct (geverifieerd, geen regressie).
- Memory-bestand `mem://design/chat-ui` wordt na Stap 4 bijgewerkt naar "max 2/2" om consistent te blijven.
