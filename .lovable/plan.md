## Doel

Realistisch nabootsen dat 10 kandidaten (or1..or10) tegelijk inloggen, en meten of de Supabase Realtime-kanalen die de dashboards voeden alle writes binnen ~2s ontvangen — zonder handmatige refresh.

De browser-automation kan maar 1 sessie tegelijk, dus gebruik ik een **headless multi-client loadtest** vanuit de sandbox die exact dezelfde `supabase-js` client en channel-config gebruikt als de echte app.

## Wat ik ga bouwen

`scripts/loadtest-realtime.ts` (alleen scripts/, geen app-code).

### Stappen die het script uitvoert

1. **Parallel inloggen**: 10 onafhankelijke `createClient` instances → `signInWithPassword` voor `or1..or10@doorai.nl` / `onderwijs010`. Plus 1 advisor-sessie (or29) die de backoffice-kanalen abonneert (profiles, appointments, conversations, messages, advisor_notes).
2. **Per-user kanalen** (zelfde signatuur als `useLiveProfile` en `Backoffice.tsx`):
   - kandidaat: `postgres_changes` op `profiles` (filter `user_id=eq.<id>`) en `appointments` (filter `user_id=eq.<id>`).
   - advisor: globale kanalen op profiles/appointments/conversations/messages/advisor_notes.
3. **Writes triggeren** (gespreid over ~10s):
   - elke kandidaat: 1 profile-update (`bio` → timestamp) + 1 appointment insert.
   - advisor: 1 advisor_note insert per kandidaat.
4. **Meten** per write: tijdstempel bij verzending → tijdstempel bij ontvangst op elk relevant kanaal. Bereken p50 / p95 / max latency en het aantal gemiste events.
5. **Rapporteren**: tabel in stdout (per sessie: events_expected, events_received, p50_ms, p95_ms) + duidelijke PASS/FAIL.

### Slagingscriteria

- **0 gemiste events** op alle 11 sessies.
- **p95 latency < 2000 ms** (Realtime SLA-ruimte).
- Geen reconnect-storm in `system`-events.

### Wat ik NIET doe

- Geen app-code wijzigen (alleen meten).
- Geen schema-wijzigingen.
- Geen permanente test-data: alle inserts worden aan het einde opgeruimd (`DELETE` op gemarkeerde `loadtest-*` rijen).
- Geen UI-screenshots van 10 browsers — niet mogelijk met de huidige browser-tool en niet nodig: het script meet de Realtime-laag direct, en die voedt de UI.

### Vervolg (optioneel, na deze meting)

Als latency of misses zichtbaar zijn, dan:
- check `supabase--db_health` voor connection-saturatie,
- check duplicate channel-subscribes in components (re-render leaks).
