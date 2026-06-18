## Doel

Multi-user demo/load mogelijk maken: 30 voorgemaakte accounts (`or1@doorai.nl` t/m `or30@doorai.nl`, wachtwoord `onderwijs010`), elk met een eigen gevuld profiel en eigen agenda. Het bestaande "demo-knop" pad wordt vervangen door een echt loginformulier zodat afspraken die in de app gemaakt worden ook echt op het juiste profiel landen.

## Wat er gebouwd wordt

### 1. Login-formulier activeren (frontend)
- `src/pages/Auth.tsx` (bestaat al) wordt het primaire inlogpunt — controleren dat email+wachtwoord login werkt en netjes redirect (candidate → `/dashboard`, advisor/admin → `/backoffice`).
- `src/components/layout/Header.tsx` en `src/components/home/HeroSection.tsx`: de `useDemoLogin`-knop ("test@doorai.nl one-click") wordt vervangen door een gewone "Inloggen" knop die naar `/auth` linkt.
- `src/hooks/useDemoLogin.ts` blijft staan maar wordt niet meer aangeroepen (kan later opgeruimd; nu behouden voor backup).
- Geen wijziging aan signup-flow (signup blijft uit voor deze demo; alleen vooraf gemaakte accounts kunnen in).

### 2. Auth-config
- `supabase--configure_auth` aanroepen met `auto_confirm_email: true` en `disable_signup: true`. Zo zijn de 30 seed-accounts direct bruikbaar zonder bevestigingsmail, en niemand kan zichzelf extra accounts aanmaken.

### 3. 30 accounts seeden (edge function)
Eenmalige edge function `seed-demo-users` die via `service_role`:
- per account: `auth.admin.createUser({ email, password, email_confirm: true })`
- profile-row aanmaakt met persona-data (de `handle_new_user` trigger doet dit al automatisch met lege waarden — de edge function vult daarna `update` met persona-velden)
- user_role zet: `or1..or28` = `candidate`, `or29` en `or30` = `advisor` (trigger maakt standaard `candidate`; overschrijven voor de twee adviseurs)
- idempotent: als email al bestaat → skip en log

Aangeroepen via een knop in `/backoffice` (alleen zichtbaar voor admin) zodat het opnieuw kan worden gedraaid zonder code-deploy.

### 4. Persona-data (30 varianten)
Een vaste JSON-lijst in de edge function met 30 Rotterdamse persona's, elk uniek over:
- naam (voornaam + achternaam, Nederlandse mix)
- huidige fase (`oriëntatie`, `keuze`, `aanmelding`, `studie`, `werk` — gespreid zodat backoffice-overzicht alle fases laat zien)
- interesses (2–4 uit: zorg, techniek, ICT, onderwijs, horeca, logistiek, creatief, ondernemen)
- opleidingsniveau, leeftijd (18–45)
- eventueel 1 voorbeeld-conversation + 2 berichten zodat "gesprekken"-tab in backoffice direct gevuld lijkt (optioneel — als je dit erbij wil staat het in scope)

### 5. Afspraken landen op juiste profiel
Bestaand: `appointments.user_id` koppelt al aan `auth.users.id`, en `ScheduleAppointmentDialog` gebruikt `auth.uid()`. Dit werkt automatisch zodra elk persoon met eigen account inlogt — geen code-wijziging nodig, alleen verifiëren.

## Verificatie

1. Login met `or5@doorai.nl` / `onderwijs010` → lands op `/dashboard` met persona-naam "Yusuf el Amrani".
2. Plan via dashboard een afspraak → check in `/backoffice` dat die onder Yusuf staat, niet onder iemand anders.
3. Login met `or29@doorai.nl` → lands op `/backoffice` (advisor-rol).
4. Open 5 tabs met 5 verschillende `orN@` accounts gelijktijdig → realtime sync werkt, geen cross-contamination.

## Technische details

- Geen schema-wijzigingen: bestaande `profiles`, `user_roles`, `appointments` tabellen volstaan.
- Edge function gebruikt `SUPABASE_SERVICE_ROLE_KEY` (al beschikbaar) — niet vanuit frontend.
- `handle_new_user` trigger draait al bij elke createUser → profile + candidate role automatisch; edge function overschrijft alleen persona-velden + rol voor de 2 adviseurs.
- Wachtwoord `onderwijs010` voldoet aan default Supabase password policy (>=6 tekens). HIBP blijft uit voor deze demo.

## Buiten scope

- Geen email-flow (signup/reset) — accounts worden direct geconfirmd.
- Geen wijziging aan AI-chat, prompts, dashboard-layout of backoffice-UI.
- Geen verwijdering van `test@doorai.nl` of `admin010` — blijft naast de 30 accounts bestaan.
