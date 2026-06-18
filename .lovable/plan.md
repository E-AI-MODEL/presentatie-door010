## Diagnose

De 30 demo-accounts bestaan nog niet in de database (gecontroleerd: 0 rijen in `auth.users` met `or%@doorai.nl`). De seed-edge-function is gebouwd, maar de seed-knop in Backoffice → Superuser is nog niet ingedrukt. Daarom geeft elke loginpoging met `or1@doorai.nl` correct "Invalid login credentials" (zichtbaar in de auth-logs).

Over "systeem mag pas wachtwoord checken na klik op Inloggen": het loginformulier in `src/pages/Auth.tsx` doet al precies dat — `signInWithPassword` wordt alleen aangeroepen in `handleSubmit` op form-submit. Geen wijziging nodig daar. Wat we wel doen: voorkomen dat browser-autofill of dubbele submits onbedoeld triggert.

## Wat ik ga doen (na approval)

1. **Seed-functie uitbreiden** zodat hij ook met `SUPABASE_SERVICE_ROLE_KEY` als Authorization aangeroepen kan worden (naast de bestaande admin-JWT check). Dit is nodig zodat ik hem eenmalig vanuit de sandbox kan starten zonder dat jij eerst hoeft in te loggen.

2. **Seed eenmaal uitvoeren** vanuit sandbox via curl met service-role. Verwacht resultaat: 30 accounts `or1@..or30@doorai.nl` aangemaakt + profielen gevuld + 2 advisors (or29, or30).

3. **Verificatie**:
   - SQL-check: `SELECT count(*) FROM auth.users WHERE email LIKE 'or%@doorai.nl'` → moet 30 zijn.
   - SQL-check: profielen hebben `first_name` ingevuld.
   - Browser-test: open preview → `/auth` → inlog `or1@doorai.nl` / `onderwijs010` → moet redirecten naar `/dashboard` met de persona-naam.
   - Browser-test: `or29@doorai.nl` → moet redirecten naar `/backoffice` (advisor-rol).

4. **Form-hardening** (klein): submit-knop disablen tijdens `loading` staat al, maar ik voeg `autoComplete="current-password"` toe en zorg dat de submit alleen via expliciete klik gebeurt (form `onSubmit` blijft, geen `onChange`-triggers). Bevestigt jouw eis dat wachtwoord pas gecheckt wordt na klikken.

## Buiten scope

- Geen schema-wijzigingen.
- Geen aanpassing aan AI-chat, dashboard of backoffice-layout.
- Het bestaande admin-only pad in de seed-functie blijft werken voor toekomstige runs vanuit de Superuser-tab.
