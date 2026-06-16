## 1. Demo pagina verwijderen

- Controleer of scr/pages/demo.tsx "zomaar weg kan" zonder andere functionaliteiten te beschadigen. Is dit veilig dan ;   
`src/pages/Demo.tsx` verwijderen
- Route `/demo` uit `src/App.tsx` halen + import weg
- Eventuele links naar `/demo` opruimen (Header, Footer, HeroSection)
- `useDemoLogin` in HeroSection blijft werken voor de bestaande "Je eerste stap…" knop (kandidaat-login)

## 2. Admin-login in burgermenu

- In `Header.tsx` (burgermenu / mobile nav) extra item **"Inloggen als admin"** toevoegen
- Klik → roept een nieuwe `loginAsAdmin()` hook aan (analoog aan `useDemoLogin`) die inlogt met `test@doorai.nl` / `admin010`-account dat reeds admin-rol heeft, en doorstuurt naar `/backoffice`
- Migration: borg dat `test@doorai.nl` zowel `candidate` als `admin` rol heeft in `user_roles` (nu alleen candidate). Zonder dit werkt de redirect maar zou backoffice-link in header niet verschijnen.
- `/auth` blijft ongewijzigd (gewone email/password login)

## 3. Drastische compacte redesign — Dashboard & Backoffice

Kleuren, fonts, design tokens, en alle functionaliteit blijven exact gelijk. Alleen layout/dichtheid verandert.

### Dashboard (`src/pages/Dashboard.tsx` + onderdelen)

Doel: alles boven de vouw, één blik = volledig overzicht.

- Vervang de huidige verticale stack door een **bento-grid** (12-koloms desktop, 2-koloms mobiel):
  - Linksboven (compact): begroeting + voortgangsbalk in één regel
  - Hoofdtegel midden: chat-CTA / actieve gespreksstatus
  - Rechts: kleine tegels voor opgeslagen vacatures, events, opleidingen (compacte counters i.p.v. lijsten)
  - Onder: 1 rij "Aanbevolen voor jou" als horizontaal scrollende mini-cards (60-80px hoog)
- Padding terug naar `p-4` / `gap-3`, kaarten van `p-8` naar `p-4`, headings van text-3xl naar text-lg
- Topic-burgermenu wordt compacte tag-rij bovenaan i.p.v. accordion
- Behoud: `useLiveProfile`, chat-overlay, alle bestaande acties/links

### Backoffice (`src/pages/Backoffice.tsx`)

Doel: command-center stijl, alle tabs vervangen door dense single-screen layout.

- Vervang tabs door **sticky linker rail** (icon + label, 48px breed collapsable) met secties: Overzicht, Chat, Afspraken, Bronnen, Prompts, Detector
- Hoofd-canvas: 2-koloms split — links lijst (compacte rijen, 36px hoog, geen kaarten), rechts detail-paneel
- Overzicht-tab: KPI-strip bovenaan (6 cijfers naast elkaar, niet als grote kaarten) + dense table
- Tabellen: rij-hoogte 32-36px, monospace voor IDs/tijden, sticky headers
- Mobiel: rail wordt bottom-tab; lijst-detail wordt sheet (huidige mobile-pattern blijft)
- Alle bestaande functies (prompt overrides, pipeline events, appointments etc.) blijven werken — alleen verpakt in compactere componenten

## 4. Veiligheid van functionaliteit

- Geen wijzigingen aan edge functions, RLS, data-flows of hooks
- Per scherm: bestaande handlers en data-fetches behouden, alleen presentation-laag herschrijven
- Na implementatie: handmatige check via preview op /dashboard en /backoffice (login als kandidaat resp. admin)

## Technische details

- Nieuwe hook `src/hooks/useAdminLogin.ts` (mirror van `useDemoLogin`)
- Migration: `INSERT INTO user_roles (user_id, role) SELECT id, 'admin' FROM auth.users WHERE email='test@doorai.nl' ON CONFLICT DO NOTHING;`
- Nieuwe componenten: `src/components/dashboard/BentoGrid.tsx`, `src/components/backoffice/SideRail.tsx`, `src/components/backoffice/DenseTable.tsx`
- Bestaande tegel/tab-componenten worden ingepakt of vervangen, niet verwijderd zolang ze elders gebruikt worden