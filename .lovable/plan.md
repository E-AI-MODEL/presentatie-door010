# Plan: Live state propagatie na inloggen

## Probleem (samengevat na onderzoek met GPT-5.5)

De app gebruikt **geen** React Query of centrale store. Elke pagina/component fetcht `profiles` één keer in een lokale `useState` bij mount. Resultaat:

- **AI edge functions (`doorai-chat`, `homepage-coach`) krijgen profiel als payload van de client**, en doen zelf geen DB-fetch. De AI werkt dus altijd op een snapshot uit het moment dat de chat overlay mountte. Test net afgerond? Sector net gewijzigd? Fase door adviseur aangepast? AI weet het niet.
- **Dashboard, ChatOverlay en Backoffice hebben geen realtime subscription op `profiles`**. Wijziging in Profile-pagina is pas zichtbaar na full page reload.
- **`maybePersistProfile` in ChatOverlay** vergelijkt nieuwe slot-waarden met een stale `profile.preferred_sector` en kan zo een net-opgeslagen sector stilletjes terugschrijven naar de oude waarde.
- **Phase detector** gebruikt `current_phase_ui` uit de stale profile state als baseline — promoties/transities kloppen niet meer als de fase elders is veranderd.
- **Backoffice** ziet kandidaten alleen via handmatige "Vernieuwen" knop.

## Aanpak — 3 lagen, in volgorde van impact

### Laag 1: AI context server-side verifiëren (hoogste prioriteit)

AI mag **nooit** vertrouwen op profile-data uit de client payload. Beide edge functions moeten verse data ophalen op basis van de JWT.

- `supabase/functions/doorai-chat/index.ts`
  - JWT uit `Authorization` header → `supabase.auth.getUser(jwt)` → `auth.uid()`
  - Verse fetch: `first_name, bio, test_completed, test_results, preferred_sector, current_phase, known_slots` uit `profiles`
  - Verse fetch: `saved_vacancies` (count + recente titels), `saved_events` (count + recente), open `appointments` voor context
  - `profileMeta` uit body wordt **alleen fallback** voor anonieme/unauth calls
  - Merge: server-verse data wint altijd van client payload
- `supabase/functions/homepage-coach/index.ts`
  - Idem patroon voor `profileContext`
- Geen breaking change in request body — client mag profileMeta blijven sturen, server overschrijft.

### Laag 2: UI-staleness binnen één sessie wegnemen

Centraal mechanisme: één `profile-updated` event + één gedeelde hook.

- Nieuwe hook `src/hooks/useLiveProfile.ts`:
  - Fetcht profile bij mount
  - Subscribet op Supabase Realtime kanaal `postgres_changes` UPDATE op `public.profiles` waar `user_id = auth.uid()`
  - Luistert ook naar `window` `profile-updated` CustomEvent (voor instant feedback zonder realtime-roundtrip)
  - Luistert naar `visibilitychange` → refetch bij terug-focussen
  - Returnt `{ profile, knownSlots, refresh }`
- Inzetten in:
  - `src/pages/Dashboard.tsx` (vervangt huidige lokale `useState` + `fetchProfile`)
  - `src/components/chat/AuthenticatedChatOverlay.tsx` (vervangt mount-only fetch — fixt ook de `maybePersistProfile` bug omdat `profile.preferred_sector` nu live is)
  - `src/pages/Profile.tsx` (form blijft eigen draft-state, maar baseline komt van hook → cancel/refresh werkt correct)
- `src/pages/Profile.tsx` `handleSubmit` na succesvolle save:
  - `window.dispatchEvent(new CustomEvent("profile-updated"))` — instant sync naar Dashboard/Overlay zonder te wachten op realtime roundtrip
- Realtime moet aangezet worden op `profiles` tabel via migration:
  - `ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;`

### Laag 3: Adviseur ↔ Kandidaat sync

- `src/pages/Backoffice.tsx`: realtime subscription op `profiles` UPDATE → merge in `profiles` state. Adviseur ziet test-completion, fase-wijziging, CV-upload van kandidaten live.
- `src/components/backoffice/CandidateDetailPanel.tsx`: bij `handleSavePhase` ook `profile-updated` event dispatchen (al gedekt door realtime, maar event is instant).
- Kandidaat-zijde krijgt fase-wijzigingen door adviseur automatisch mee zodra Laag 2 + realtime op `profiles` werkt. Phase detector baseline klopt dan ook.

## Technische details

**Bestanden te wijzigen:**
- `supabase/functions/doorai-chat/index.ts` — server-side profile fetch
- `supabase/functions/homepage-coach/index.ts` — server-side profile fetch
- `src/hooks/useLiveProfile.ts` — **nieuw**, gedeelde hook
- `src/pages/Dashboard.tsx` — gebruik hook
- `src/pages/Profile.tsx` — gebruik hook + dispatch event na save
- `src/pages/Backoffice.tsx` — realtime subscription op profiles
- `src/components/chat/AuthenticatedChatOverlay.tsx` — gebruik hook (fixt ook persist-overwrite bug)
- Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;`

**Niet gewijzigd:**
- SSOT JSON-bestanden, themes, chat UI, sanitizers, FAQ search
- Request/response shape van edge functions (alleen interne data-bron verandert)
- RLS policies (huidige policies zijn voldoende voor realtime — `auth.uid() = user_id` filter werkt)

**Verificatie na build:**
1. Profile wijzigen → Dashboard badge update binnen 1s zonder reload
2. Test afronden in apart tabblad → chat overlay weet `test_completed: true` bij volgende AI vraag
3. Adviseur wijzigt fase in backoffice → kandidaat ziet nieuwe fase live in dashboard
4. AI-antwoord referenceert vers `preferred_sector` direct na wijziging (logging in edge function check)

## Wat ik NIET doe in deze ronde

- React Query introduceren (groter refactor; event + realtime + hook is voldoende voor nu)
- Multi-conversation support in `AdvisorChatPanel` (apart issue, geen staleness)
- Profile-page optimistic UI rewrite (huidige draft-state is intentioneel)
