# Kleine totaalfunctie-test (geautomatiseerd)

Credit-check: **36,90 build-credits** + AI gateway balance (apart, $1/maand gratis). Voor deze test ruim voldoende — AI-calls beperkt tot ~5 berichten in totaal (~$0.05).

## Wat de test dekt

Eén nieuw script `scripts/smoketest-full.ts` dat in volgorde 4 blokken doorloopt en pass/fail per blok rapporteert.

### Blok 1 — Multi-login realtime sync
Hergebruikt logica uit `scripts/loadtest-realtime.ts`:
- Login or1–or10 (kandidaten) + or29 (advisor) parallel
- Subscribe per-user channels + advisor backoffice-wide channel
- Trigger writes (profile/appointment/note), meet fanout-latency
- **Pass-criterium:** 0 missed events, p95 < 2000ms

### Blok 2 — Kandidaat happy path (1 user, or1)
- Login or1 → `profiles.update({ bio, current_phase })` → verifieer write
- POST naar edge function `doorai-chat` met 1 testbericht → check 200 + non-empty stream
- `appointments.insert({ status: 'pending' })` → check advisor-channel ontvangt event
- **Pass:** alle 3 steps OK

### Blok 3 — Backoffice actie (or29 → or1)
- Advisor `advisor_notes.insert` + `appointments.update({ status: 'confirmed' })` voor or1
- Or1's openstaande channel checkt of update binnen 2s binnenkomt
- **Pass:** event ontvangen < 2000ms

### Blok 4 — AI guardrails sanity
- 1 chatcall met prompt die forbidden term zou kunnen uitlokken ("welke fase ben ik in?")
- Response sanitizen-check: geen `/dashboard`, `/profile`, `fase`, `intake`, `peildatum`, em-dashes, emoji's in output
- **Pass:** geen forbidden patterns

## Output
Console-rapport per blok + samenvatting:
```
[BLOK 1] Realtime sync       ✅  missed=0 p95=412ms
[BLOK 2] Kandidaat flow      ✅  3/3 steps
[BLOK 3] Backoffice actie    ✅  778ms
[BLOK 4] AI guardrails       ✅  0 violations
OVERALL: ✅ PASS
```
Exit code 0 bij pass, 1 bij fail. Test-data wordt aan einde opgeruimd (appointments + notes delete).

## Out of scope
- Geen UI-screenshot/visuele checks (puur API/realtime)
- Geen schema-wijzigingen
- Geen wijziging aan productiecode — alleen nieuw script

## Bestanden
- **Nieuw:** `scripts/smoketest-full.ts`
- **Geen edits** in app-code

## Uitvoeren (na build mode)
```
bun scripts/smoketest-full.ts
```
Looptijd ~30-45s.
