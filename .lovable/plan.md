## Achtergrond

De hub-merge is af. Nu twee vervolgvragen uit jouw bericht:

1. **Waarom kan ik in chat geen topics (via burgermenu zoals voorheen) of andere "back-end" structuren meer aanklikken?**
2. **Stijl & toon van DoorAI** — context die toch al in de prompt zit, subtiel verwerken in het antwoord.

## Wat ik heb gevonden

- `TopicMenu` bestaat alleen op `/dashboard` (tab Vandaag). In de chat-overlay (`AuthenticatedChatOverlayV3.tsx`, `PublicChatWidget.tsx`) is geen verwijzing meer naar TopicMenu of een burger-icoon.
- Memory zegt expliciet: *"Topic-burgermenu default OPEN in persoonlijke chat"*. Dat is dus regressie — het hoort in de chat-overlay te zitten, niet alleen op de hub.
- Chips renderen wél nog (`ChatTurnArtifacts`), maar de inline topic-launcher binnen het gesprek mist.

Voor de toon-vraag heb ik nog niet gemeten — dat doe ik bij de exploratie van stap 2.

## Plan

### Deel 1 — Topic-menu terug in chat

1. **Inventariseer** wat er beschikbaar is in de chat-overlay: header-slot, side-panel, of bottom-sheet op mobiel.
2. **Voeg een topic-trigger toe** in de chat-overlay header:
   - Desktop: linker burger-icoon (☰) dat een **side-panel** opent met `TopicMenu` (zelfde component als op hub — single source).
   - Mobiel: zelfde icoon, opent een `Sheet` (bottom-sheet) met TopicMenu.
   - Default OPEN bij eerste keer chat openen (volgens memory). State per sessie.
3. **Click op een topic** stuurt `doorai-send-message` event (zoals nu) en sluit het paneel op mobiel; blijft open op desktop.
4. **"Back-end" structuren** — context-bronnen die DoorAI gebruikt (FAQ, vacatures, opleidingen, events) krijgen onder TopicMenu een sectie "Verken bronnen" met directe in-chat links (geen path-strings, gewoon nette labels) die een gestructureerde vraag triggeren.

### Deel 2 — Stijl & toon van DoorAI

5. **Audit huidige prompt-templates** (`supabase/functions/doorai-chat/...` of equivalent): welke profile-context wordt al meegestuurd (naam, fase, sector, recente acties)?
6. **Voeg een "natuurlijke verwijzing"-richtlijn toe** aan de system prompt:
   - Als er een naam in context zit: noem die max 1x per gesprek, niet in elke beurt.
   - Als sector bekend is: verwerk subtiel ("voor het basisonderwijs...") zonder de woorden "sector" of "fase".
   - Als recente actie bekend is (bv. CV geüpload, test afgerond): verwijs max 1x als dat antwoord-relevant is ("nu je je CV hebt klaarstaan...").
   - Strikt: nooit context dumpen, nooit metadata-taal ("ik zie in je profiel dat..."), nooit forbidden terms.
7. **Toon-regels** scherper: warm, action-first, korte zinnen. Geen emoji, geen em-dash (al in memory). Toevoegen: geen "Geweldig!", "Wat leuk!" openers.
8. **Test-fixtures**: 3 voorbeeldvragen per fase met verwachte tone-markers, run via een korte script-check tegen de edge function in dev.

## Technisch

- Topic-menu in chat: nieuwe wrapper `ChatTopicPanel.tsx` + integratie in `AuthenticatedChatOverlayV3.tsx`. Hergebruikt bestaande `TopicMenu` component.
- Prompt-aanpassingen: alleen system-prompt fragmenten, geen schema/edge-function logica.
- Geen backend changes, geen nieuwe tabellen.

## Out of scope

- Stem-input, file-upload binnen chat
- Nieuwe topic-categorieën (gebruikt huidige `getPhaseTopics`/`getSSOTTopics`)
- Volledige prompt-rewrite

## Risico's

- Topic-panel in mobile chat mag de typing-area niet verbergen → state moet sluiten bij focus op input.
- Subtiele context-verwerking is makkelijk te ver door te slaan ("Hé Jan, fijn dat je..."). Strikte voorbeelden in prompt zijn essentieel.

Geef GO en ik begin met Deel 1 (topic-menu in chat).
