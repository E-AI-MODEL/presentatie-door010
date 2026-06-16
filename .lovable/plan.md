# Demo-sweep DOOR — geconsolideerd plan

## 0. Runtime-bevestiging (eerst gecheckt, voorkomt dat we het verkeerde bestand patchen)

```
App.tsx  →  AuthenticatedChatOverlayV2 (alias)  →  AuthenticatedChatOverlayV3  ← LIVE
AuthenticatedChatOverlay.tsx (V1, 980 r)  ← DOOD, nul live imports
```

Dus: alle fixes hieronder raken **V3** (`src/components/chat/AuthenticatedChatOverlayV3.tsx`). V1 wordt verwijderd, niet gerepareerd. V2-shim wordt opgeruimd door `App.tsx` direct naar V3 te laten importeren.

---

## A. Demo-blockers (5 — eerst doen)

### A1. Persoonlijke chat krijgt geen profiel mee  *(V3 + edge function)*
Twee bugs samen:
- V3 stuurt `Authorization: Bearer <publishable key>` → server kan JWT niet matchen → verse profile-fetch wordt stil geskipt.
- V3 stuurt body-key `profileContext`, server leest `profileMeta` → naam/bio/sector/fase/test-resultaten komen nooit binnen.

Fix: echte session-JWT in header (`supabase.auth.getSession()`), body-key hernoemen naar `profileMeta`, server-side debug-log `[doorai] uid=… first_name=…`.

### A2. V3 negeert `useLiveProfile`  *(V3)*
V3 doet eenmalige `useEffect`-fetch. Adviseur-wijzigingen of test-completion in andere tab landen niet live.

Fix: lokale fetch vervangen door `useLiveProfile(user?.id, "current_phase, preferred_sector, first_name, bio, test_completed, test_results, known_slots")`. `notifyProfileUpdated()` na phase-accept behouden.

### A3. Slot-chips vullen het slot niet  *(client phase detector)*
Action-chips voor `role_interest` en `credential_goal` sturen canonieke codes (`leerlingenzorg`, `instructeur`, `po_bevoegdheid`, `verkennen`) terug. `extractSlots` in `src/utils/phaseDetectorEngine.ts` matcht alleen NL-woorden → slot blijft leeg → AI vraagt opnieuw.

Fix: alias-tabel client-side (gelijk aan server `ROLE_ALIASES`) toevoegen aan `extractSlots`, of chips laten Nederlandse labels sturen i.p.v. codes.

> Let op: `phaseDetectorEngine.ts` werd in audit als "dead" gemarkeerd omdat alleen V1 het importeerde. Snelle re-check: ook V3 gebruikt `runPhaseDetector`. **Niet verwijderen** zolang V3 leeft. Cleanup-lijst hieronder is daarop bijgewerkt.

### A4. Firecrawl vuurt niet bij lege `trusted_sources`
`webFallbackSearch` is gegate op `trustedSources.length > 0`. Lege tabel = alle "verse-bron"-flow stil weg, terugval op SSOT (mei 2026) zonder zichtbaar signaal.

Fix: 4–5 actieve rijen seeden (onderwijsloket.com, duo.nl, voion.nl, rijksoverheid.nl, vo-raad.nl) + startup-log `[doorai] trustedSources count=…`.

### A5. Races rond `known_slots` + phase-accept  *(V3 + server)*
- `known_slots` wordt 2× per turn naar DB geschreven (client vóór fetch, server na stream) → snelle 2e turn kan oudere set overschrijven.
- `handlePhaseAccept` roept synchroon `sendMessage("Ja, graag.")` aan vóór React `profile`-state propageert → 1e post-accept turn stuurt oude fase mee.

Fix: client-side `known_slots`-write verwijderen (server = bron van waarheid); phase-accept pas vuren ná `setProfile` (via useEffect of `await`).

---

## B. Code-cleanup (alleen veilig na A — runtime-geverifieerd)

Veilig te verwijderen (nul live imports, alleen door V1 of niets):
```
src/components/chat/AuthenticatedChatOverlay.tsx        (V1, 980 regels)
src/components/chat/ResponseActions.tsx                 (alleen V1)
src/components/chat/PhaseConfirmation.tsx               (alleen V1)
src/components/chat/IntakeSheet.tsx                     (0 imports)
src/components/chat/ChatActions.tsx                     (0 imports)
src/components/chat/ChatSuggestions.tsx                 (0 imports)
src/utils/conversationRouter.ts                         (alleen V1)
src/utils/phaseDetectorParser.ts                        (0 imports)
src/utils/normalizeMarkdown.ts                          (0 imports)
```

**NIET verwijderen** (corrigeert eerdere audit):
- `src/utils/phaseDetectorEngine.ts` → V3 gebruikt `runPhaseDetector` actief.

V2-shim opruimen:
- `App.tsx:8` direct laten importeren uit `AuthenticatedChatOverlayV3`.
- `AuthenticatedChatOverlayV2.tsx` daarna verwijderen.

Kleine dode exports:
- `KNOWLEDGE_AS_OF` uit `supabase/functions/_shared/constants.ts`.
- `reflectOnDraft()` uit `src/utils/responsePipeline.ts`.

Bevestigen vóór delete (mogelijk extern getriggerd, niet vanuit `src/`):
- Edge functions `ingest-faqs`, `scrape-events`, `seed-admin-users`, `get-profiles-with-email`. Alleen markeren, niet verwijderen zonder akkoord.

---

## C. Kwaliteitspolish (na A+B, vóór demo)

1. **Sanitizer-sync**: client mist `"als ai"`, `"globaal zo uit"`, en `SCORE_INLINE_RE`. Gedeelde regexes verplaatsen naar één `sanitizeRegexes.ts` of strikt syncen.
2. **`sanitizeClient` bare `"fase"`**: breekt "beginfase/testfase" niet, maar wel "begin fase" → regex preciezer maken.
3. **Latency 1e token**: `classifyIntent` en `retrieveFaqKnowledge` parallel via `Promise.all` (bespaart 0.5–1 s).
4. **Error-bodies**: V3 leest 429/402-JSON en toont specifieke melding i.p.v. generiek "er ging iets mis".
5. **Reflection-chip**: spec-keuze maken — label "Mogelijk onvolledig" en alleen tonen bij echte issue, óf `wasRepaired`-signaal exposen.
6. **Em-dash strip**: ook in eindpass `sanitizeAssistantText`, niet alleen in repair-tak.
7. **`assembleContext` 3 600-char truncatie**: logregel + links beschermen bij truncatie.
8. **`previous_next_slot`** wordt door V3 nooit doorgegeven → slot-rotatie werkt niet → caller fixen of parameter verwijderen.

---

## D. Volgorde + verificatie per stap

```
1. A1 profile-context fix          → test: server-log toont uid + first_name
2. A2 useLiveProfile in V3         → test: adviseur wijzigt fase → chat ziet binnen 1 s
3. A4 trusted_sources seeden       → test: "wat verdien ik?" → bron-chip Firecrawl
4. A3 slot-chip aliassen           → test: klik "Leerlingbegeleiding" → vervolgvraag verandert
5. A5 races opruimen               → test: 2 snelle berichten → known_slots compleet
6. B  cleanup + V2-shim weg        → build groen
7. C1–C8 polish-batch              → losse smoke-tests
```

---

## E. Niet aanpassen zonder akkoord

- Edge functions zonder `src/`-refs (mogelijk via cron/CLI getriggerd).
- `MODELS.primary = "openai/gpt-5.4"` (alleen verifiëren via gateway-log).
- Dashboard fase-titels (`Oriënteren` etc.) — bewuste UI-keuze, valt buiten "geen fasenamen in chat"-regel.

---

Bij akkoord: A-blok eerst in één run met log-verificatie tussendoor, dan B en C? Of liever na elke A-stap pauze om in de UI te kijken?
