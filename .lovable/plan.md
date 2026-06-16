## Doel

`/backoffice` veel compacter en interactiever maken: alles inklapbaar, korter, en met de functies die nu ontbreken (afspraak inplannen vanuit advisor, vollere gesprekken-tab, dichtere bronnen-tab). Whitelist-koppeling met de persoonlijke chat ook expliciet zichtbaar.

## Bevestigd uit codebase

- `trusted_sources` wordt al actief gebruikt in `supabase/functions/doorai-chat/index.ts` (regel 330 = filter externe links; regel 523 = ophalen voor Firecrawl). Whitelist is dus écht aangesloten op de persoonlijke chat. We maken dit alleen zichtbaar in de UI.
- `appointments`-tabel bestaat al met `user_id, subject, message, preferred_date, preferred_time, status` — nieuwe afspraak is een simpele `insert`.
- Test-kandidaat = `test@doorai.nl` (huidig admin-login én demo-kandidaat). Voor "altijd in agenda van het gebruikersprofiel" matchen we op dat e-mailadres.

## Wijzigingen

### 1. Overzicht — kandidaten compact en groepeerbaar
- `UserOverviewTable`: 
  - Filters in `<details>` (default dichtgeklapt, opent met aantal actieve filters als badge).
  - Tabel-rijen 32px hoog (was ~64): avatar 24px, één regel naam + email, fase-pill ipv volledige `PhaseStatusBar`, documenten als 2 dots.
  - Nieuw: **groepeer-toggle** "Per fase" — toont 5 collapsible groepen (Interesseren, Oriënteren, Beslissen, Matchen, Voorbereiden) elk met count + chevron, default 1e groep open.
  - "Compact / Comfort"-switch in de toolbar.

### 2. Afspraken — advisor kan zelf inplannen
- Nieuwe knop **"Afspraak inplannen"** rechtsboven in de Afspraken-sectie.
- Dialog met: kandidaat-select (default = `test@doorai.nl`, zoekbaar), onderwerp, datum (Calendar popover), tijd (Input type=time), notitie. Status = `confirmed`.
- `INSERT` in `appointments` met `user_id` van de gekozen kandidaat → realtime push zet hem direct in profile-agenda van die gebruiker. Optioneel: ook een advisor-message in de bestaande conversatie ("Ik heb een afspraak ingepland voor …").
- Demo-toelichting boven de knop: *"Afspraken landen automatisch in het profiel van de gekozen kandidaat."*

### 3. Gesprekken — uitgebreider en informatiever
- Linker kandidatenlijst (1/4):
  - Filter-strip: Zoek, "Alleen ongelezen", fase-dropdown.
  - Elke rij toont: avatar + naam + fase-pill + ongelezen-badge + **preview van laatste bericht** (1 regel truncate) + tijd.
  - Collapsible "Gearchiveerd / oud" sectie onderaan voor gesprekken > 30 dagen.
- Rechter chatpaneel (3/4):
  - Sticky header met naam + fase + snel-acties: **Afspraak inplannen** (opent dezelfde dialog, voor-ingevuld op deze kandidaat), **Bekijk profiel**, **Wijzig fase**.
  - Onder de header een uitklapbare strip "Context" (default open): laatste 3 events uit de pipeline (fase-wijziging, CV-upload, test-resultaat).
  - Berichten-stream blijft, maar advisor-bubbel krijgt een duidelijke "Advisor"-label en betere typografie.

### 4. Bronnen (whitelist) — dichter, inline editable, getest
- `TrustedSourcesTab`:
  - Bovenin een **status-bar**: "✓ Whitelist actief in persoonlijke chat — externe links worden gefilterd, Firecrawl gebruikt alleen actieve bronnen." (statische tekst — koppeling bestaat al server-side).
  - Add-form blijft maar wordt smaller in een 1-regel inline composer.
  - Categorieën worden **collapsible** (`<details>` per categorie met count en chevron, default open voor "algemeen"/eerste).
  - Rij compact: 28px, switch links + label inline-editable + URL (klikbaar in nieuwe tab) + categorie-badge + delete-icon. Toon ook `last_used_at` als beschikbaar (anders niets).
  - Filter-tabs bovenaan: "Alles / Actief / Inactief" + zoekveld.
  - Bulk-actie: meerdere selecteren → activeren/deactiveren/verwijderen.

### 5. Algemene collapsibles
- KPI-strip krijgt al een toggle (bestaat). Toevoegen: per sectie een chevron-collapse boven de Card-titel zodat advisor zelf bepaalt wat zichtbaar is.

## Niet-doen
- Geen schema-wijzigingen (alle tabellen bestaan).
- Geen wijziging aan `doorai-chat` / `homepage-coach` edge functions — whitelist-koppeling werkt al.
- Geen e-mail-notificatie bij advisor-afspraak in deze ronde (kan later).

## Bestanden

- `src/pages/Backoffice.tsx` — collapsible-toggles per sectie.
- `src/components/backoffice/UserOverviewTable.tsx` — compact mode + groepering per fase + collapsible filters.
- `src/components/backoffice/AppointmentsTab.tsx` — "Plan afspraak"-knop + dialog (kandidaat-select, datum, tijd, onderwerp, notitie).
- Nieuw: `src/components/backoffice/ScheduleAppointmentDialog.tsx` — herbruikbaar in Afspraken-tab én Gesprekken-tab.
- `src/components/backoffice/AdvisorChatPanel.tsx` — sticky action-header + context-strip + snel-acties.
- `src/components/backoffice/TrustedSourcesTab.tsx` — collapsible categorieën, dense rijen, filter-tabs, bulk-acties, whitelist-status-bar.

## Verificatie

- Plan afspraak voor test-kandidaat → verschijnt direct in `/profile` (AppointmentTile) van diezelfde gebruiker via realtime.
- Whitelist toggle op `false` voor een bron → `doorai-chat` Firecrawl-bron-lijst neemt 'm niet meer mee (bestaande server-logica).
- Kandidatenlijst < 50% van huidige hoogte na compact-toggle.
