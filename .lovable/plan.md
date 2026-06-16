## Probleem

Server stuurt correct max 2 actions + 2 links. De UI rendert er maar 1 + 1 omdat `normalizeTurnArtifacts` en `ChatTurnArtifacts` allebei `.find()` / `[0]` gebruiken.

**Root cause** (`src/utils/chatTurnArtifacts.ts`):
- `normalizeTurnArtifacts` pakt alleen `meta.actions?.[0]` (regel 126) en `meta.links?.[0]` (regel 130).
- `dedupeArtifacts` reduceert nogmaals naar 1 question + 1 source (regel 216-223).
- `ChatTurnArtifacts.tsx` toont vervolgens ook alleen de eerste question + source via `.find()`.

Dit conflicteert met Core memory: *"Max 2 action chips, 2 link chips"*.

## Wijzigingen

### 1. `src/utils/chatTurnArtifacts.ts`
- `normalizeTurnArtifacts`: itereren over `meta.actions` (cap 2) en `meta.links`/`verified_links` (cap 2 totaal, verified eerst), in plaats van alleen index 0.
- `primary_followup` blijft prioriteit krijgen als eerste question chip; daarna vullen met overige actions tot max 2.
- `dedupeArtifacts`: behoudt tot 2 questions en 2 sources (op `id` ontdubbelen), plus 1 status. Decision blijft exclusief.
- Doubt-pad blijft 1 vaste "Help me kiezen" chip + eventuele source.

### 2. `src/components/chat/ChatTurnArtifacts.tsx`
- Vervang `find(...question)` en `find(...source)` door `filter(...)` met `.slice(0, 2)`.
- Render alle question chips in de flex-wrap rij, daarna alle source chips.
- Decision-pad ongewijzigd (exclusief, vervangt rest).

### 3. Verificatie
- Chat-turn in preview met "Wat verdien ik en wat voor functies zijn er in po?" → verwacht 2 action chips ("Verdienen", "Functies") + 1 link chip ("Routes bekijken").
- Edge-logs blijven `slots=N` tonen (geen backend-wijziging).

## Niet-doel

- Geen wijziging in edge function / prompts / server-side chip cap.
- Geen wijziging in confidence/status/decision logica.
- Geen visuele restyle van chips zelf.
