## Doel
De "Vernieuwen"-knop in /backoffice is nu nodig omdat alleen `profiles` realtime streamt. Appointments, conversations en messages updaten pas na een handmatige refresh. We maken alles auto-streamend zodat de knop overbodig wordt (we laten 'm wel staan als noodknop, maar discreet).

## Wat er nu wel/niet streamt
- Streamt al: `profiles` (insert/update) in `Backoffice.tsx`, en `messages` per geopend gesprek in `AdvisorChatPanel.tsx`.
- Streamt niet: `appointments` (KPI "openstaande afspraken", AppointmentsTab, kandidaat-detail), `conversations` / laatste-bericht-preview in de chatlijst, ongelezen-tellers, advisor notes op andere kandidaten dan de geopende.

## Aanpak

### 1. Realtime aanzetten op de ontbrekende tabellen (migratie)
Toevoegen aan `supabase_realtime` publication, en `REPLICA IDENTITY FULL` zodat updates volledige rijen meesturen:
- `public.appointments`
- `public.conversations`
- `public.messages` (mocht 'ie er nog niet inzitten)

Alleen toevoegen als ze er nog niet in zitten (idempotent via `pg_publication_tables`-check).

### 2. Realtime-kanaal uitbreiden in `src/pages/Backoffice.tsx`
Het bestaande `backoffice-profiles` kanaal uitbreiden met extra listeners:
- `appointments` INSERT/UPDATE/DELETE -> `checkAccessAndFetchData()` (debounced ~400ms)
- `conversations` INSERT/UPDATE -> idem
- `messages` INSERT -> idem (voor ongelezen-tellers en laatste-bericht-preview in de chatlijst)

Debounce om burst-updates (bv. AI-stream die meerdere message-rows schrijft) niet 10x te laten refetchen.

### 3. UI: refresh-knop herpositioneren
- Knop blijft beschikbaar als fallback, maar krijgt een subtielere plek (icon-only in de topbar, tooltip "Handmatig verversen").
- Kleine live-indicator (groene dot + "Live") naast de knop zodat de gebruiker ziet dat auto-streaming actief is. Wordt rood/grijs als het realtime-kanaal `CHANNEL_ERROR` of `CLOSED` rapporteert; dan is de refresh-knop wél nuttig.

### 4. Verificatie
- Tweede tab openen, daar een afspraak/bericht aanmaken, en checken dat de backoffice-lijst binnen ~1s update zonder klik op Vernieuwen.
- Console-log van het kanaal-subscribe-status checken (`SUBSCRIBED`).

## Technische details
- Migratie:
  ```sql
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='appointments') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
    END IF;
    -- idem voor conversations, messages
  END $$;
  ALTER TABLE public.appointments REPLICA IDENTITY FULL;
  ALTER TABLE public.conversations REPLICA IDENTITY FULL;
  ALTER TABLE public.messages REPLICA IDENTITY FULL;
  ```
- Debounce via simpele `setTimeout` + ref, geen extra dependency.
- Geen wijzigingen aan RLS nodig (advisors/admins hebben al leesrechten).

## Wat ik NIET doe
- Geen herontwerp van de backoffice-layout.
- Geen functionele wijziging aan AdvisorChatPanel (die streamt al).
- Refresh-knop niet verwijderen — alleen subtieler maken.