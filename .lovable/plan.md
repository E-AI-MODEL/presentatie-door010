# Plan: Dead code wegsnijden + sterke functies benutten

Twee scans afgerond. Conclusie: ~10 orphan files, ~27 unused exports, en 3 plekken waar al-bestaande sterke logica nét niet wordt gebruikt. Hieronder een minimaal-risico aanpak in drie tranches.

---

## Tranche 1 — Veilig verwijderen (zero runtime impact)

Bestanden die nergens worden geïmporteerd:

- `src/components/NavLink.tsx`
- `src/components/home/JourneySection.tsx`
- `src/components/home/TestimonialsSection.tsx`
- `src/components/dashboard/DashboardCards.tsx`
- `src/components/dashboard/PhaseCard.tsx` (Dashboard gebruikt `PhaseProgress`)
- `src/components/profile/ProfileTileWrapper.tsx`
- `src/components/onboarding/TestOnboardingPopup.tsx` + `TestInfoModal.tsx` (gesloten loop, niet bereikbaar)
- `src/components/ui/use-toast.ts` (shim — consumers importeren direct uit `@/hooks/use-toast`)

Unused exports binnen levende files weghalen:

- `src/utils/responsePipeline.ts`: verwijder `ANSWER_TYPE_RULES`, `INTERNAL_URLS`, `classifyAnswerType`, `needsClarification`, `buildIntakeQuestions`, `ReflectionResult`, `VerifiedLink`, `IntakeQuestion`, `IntakeBatch`, `FollowUpAction`, `FORBIDDEN_PHRASES`, `FORBIDDEN_PATTERNS` — behoud alleen `parseStructuredMeta` + `resolveInternalUrl` (die laatste verplaatsen we, zie Tranche 3).
- `src/hooks/use-toast.ts`: `reducer` export weghalen (intern houden).
- `src/data/dashboard-phases.ts`: `quickLinks`, `PhaseAction` weg.
- `src/utils/chatTurnArtifacts.ts`: niet-geïmporteerde sub-types intern maken (geen `export`).
- `src/utils/themeMapper.ts`: `publicThemes` weg (server-side variant in `_shared/themes.ts` blijft).

Duplicaten:

- `Appointment`, `SavedEvent`, `SavedVacancy` interfaces: één SSOT in `src/types/backoffice.ts`, profile-tiles + `UserOverviewTable` importeren daar.

---

## Tranche 2 — `phaseDetectorEngine` beslissen

`runPhaseDetector` is een complete client-side engine maar wordt nergens aangeroepen — alleen types (`KnownSlots`, `DetectorPhaseCode`) worden gebruikt. Phase-detectie gebeurt server-side in `doorai-chat`.

Voorstel: **engine slopen, types behouden.**

- Knip de gebruikte types (`KnownSlots`, `DetectorPhaseCode`, `UiPhaseCode`) naar `src/types/phase.ts`.
- Verwijder `src/utils/phaseDetectorEngine.ts` volledig (scoring, transities, `themeHintForTransition`-aanroep).
- Update imports in `TopicMenu.tsx`, `RecommendedContent.tsx`, `Dashboard.tsx`.
- `themeHintForTransition` in `themeMapper.ts` blijft alleen als hij elders gebruikt wordt — anders ook weg.

Reden: server is SSOT voor fase. Een tweede client-engine introduceert drift-risico.

---

## Tranche 3 — Sterke functies écht benutten (3 quick wins)

### 3a. `known_slots` hydrateren uit DB op elke turn
In `supabase/functions/doorai-chat/index.ts` wordt `fresh.known_slots` wel geselecteerd (regel ~984) maar niet gemerged in de actieve slot-state (regel ~1010 leest alleen `detector?.known_slots`).

Fix:
```ts
const mergedSlots = { ...(fresh?.known_slots ?? {}), ...(detector?.known_slots ?? {}) };
```
Effect: slots overleven page-refresh / cross-session automatisch, infra bestaat al.

### 3b. `useChatConversation` inzetten in V3 (of slopen)
Hook bestaat met realtime + persist + sanitize + reset, maar `AuthenticatedChatOverlayV3` re-implementeert dat inline.

Twee opties — kiezen in build mode:
- **A. Adopteren**: V3 vervangt inline load/save/realtime door `useChatConversation`. Echte refactor, ~30 min, test-risico.
- **B. Slopen**: hook + `parseActions` weg, geen nieuwe gedragingen.

Mijn advies: **B** (slopen) — V3 werkt nu correct na de cleanups van vorige rondes, refactor levert geen functionele winst, alleen risico.

### 3c. `resolveInternalUrl` als SSOT voor interne paden
`doorai-chat` heeft eigen `computeLinks` / `INTERNAL_URLS`. `responsePipeline.ts` had al `resolveInternalUrl`. Verplaats die naar `supabase/functions/_shared/internal-urls.ts` zodat edge-functie + client dezelfde keyword→path mapping gebruiken. Voorkomt drift met de FORBIDDEN_PATTERNS sanitizer.

### 3d. `_shared/turn-meta.ts` (`buildTurnMeta`) — beslissen
Bestaat, wordt door niemand gebruikt. Of inzetten in `doorai-chat` als artifact-constructor (server↔client schema-sync), of verwijderen.
Advies: **verwijderen** tenzij we binnenkort meer artifact-types toevoegen.

---

## Niet in scope
- Geen wijzigingen aan `sanitize.ts` / `themes.ts` duplicatie tussen client en edge — bewuste split (browser vs Deno).
- Geen UI/visuele wijzigingen.
- Geen model- of prompt-aanpassingen.

---

## Volgorde van uitvoering
1. Tranche 1 (delete-only, ~5 min)
2. Tranche 2 (phaseDetectorEngine slopen, types verplaatsen)
3. Tranche 3a (slot-merge fix — grootste functionele winst)
4. Tranche 3b/c/d (alleen B+C+D weg-variant tenzij je 3b-A wilt)
5. Build-check + 1 chat-turn runtime verificatie

## Beslismomenten voor jou
- **3b**: hook adopteren (A) of slopen (B)? Mijn advies: **B**.
- **3d**: `buildTurnMeta` inzetten of slopen? Mijn advies: **slopen**.
