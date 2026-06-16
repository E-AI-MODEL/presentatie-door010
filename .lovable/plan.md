## Advies: verifiëren → polish → opruimen

### 1. Verificatie (15 min)
Voordat we verder gaan, moeten we zeker zijn dat de A1-A5 fixes echt werken in runtime.

- **A1 (JWT + profileMeta):** Login als kandidaat, start een chat. Controleer server-logs op `[doorai-chat] profile uid=… first_name=…` — dit bewijst dat de echte user-JWT aankomt en `profileMeta` correct wordt uitgelezen.
- **A3 (slot chips):** Klik in de chat op een slot-chip (bv. "leerlingenzorg"). Controleer dat `extractSlots` de canonical code herkent en dat `known_slots` in de database wordt bijgewerkt.
- **A5 (race condition):** Accepteer een voorgestelde fase. Controleer dat het profiel realtime update (via `useLiveProfile`) en dat `handlePhaseAccept` niet meer een losse `sendMessage("Ja, graag.")` triggert voordat de state is doorgestroomd.

Als een van deze drie faalt, fixen we direct voordat we verder gaan.

### 2. C-Polish (30 min)
Alles wat de gesprekskwaliteit en robuustheid verbetert, maar geen demo-blocker is.

- **C1 Sanitizer sync:** Client `sanitizeClientText` en server `sanitizeForDisplay` moeten dezelfde `FORBIDDEN_PATTERNS` en regex-logica gebruiken. Nu lopen ze uit de pas.
- **C2 Latency:** Start FAQ-zoeken en Firecrawl-verzoek parallel met `Promise.all`, in plaats van sequentieel. Eerste token komt dan sneller bij de gebruiker.
- **C3 Error bodies:** Edge function mag nooit een lege HTTP 500 terugsturen. Altijd een JSON-body met `error` en `message`.
- **C4 Reflection-chip:** Toon de chip "Mogelijk onvolledig" alleen wanneer de AI expliciet aangeeft dat het antwoord onzeker is (twee signalen: laatste bubble krijgt ambient tint + losse chip).
- **C5 Em-dash strip:** Voeg em-dash (`—`) toe aan `sanitizeClientText` zodat deze wordt gestript of vervangen, consistent met andere leestekens.
- **C6 assembleContext truncation:** Zet een harde limiet (bijv. 3000 tekens) op de geassembleerde context voordat deze naar het model gaat, om token-overschrijding te voorkomen.
- **C7 previous_next_slot fix:** De parameter `previous_next_slot` wordt soms niet correct doorgegeven in de SSE-stream. Zorg dat deze altijd aanwezig is in de payload als er een volgende slot verwacht wordt.

### 3. Edge Cleanup (10 min)
Markeren en verwijderen van dode edge functions die geen runtime-import hebben:
- `ingest-faqs`
- `scrape-events`
- `seed-admin-users`
- `get-profiles-with-email`

### Niet in scope
- Model switch (gpt-5.4 werkt goed, geen actie nodig).
- Dashboard fasetitels (bewust behouden).

### Volgorde
Verificatie → C1 t/m C7 → Edge cleanup.