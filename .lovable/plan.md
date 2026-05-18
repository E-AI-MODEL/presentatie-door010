
Onderzoek afgerond: de pipeline klopt inderdaad nog niet volledig. Ik heb dit live gereproduceerd in de chat.

### Wat er nu feitelijk misgaat
1. `homepage-coach` stuurt nog steeds externe chip-links met onvolledige `href` terug, zoals `onderwijsloket.com` en `voraad.nl` zonder `https://`.
2. De publieke pipeline kiest externe bronnen te grof: bij bron-/feitenvragen worden actieve `trusted_sources` bijna blind toegevoegd, niet echt op relevantie of categorie geselecteerd.
3. De antwoordtekst zelf wordt niet tegen de whitelist gevalideerd. Daardoor kan het model nog steeds een losse of hallucinatoire URL in de tekst zetten, zoals `(...https://www.rijksoverheid.nl/...)`.
4. De frontend rendert deze output wel, maar repareert de backend-fouten niet. Daardoor krijg je een mix van:
   - lelijke inline URL’s in de tekst
   - chip-links die niet betrouwbaar of niet goed navigeerbaar zijn
   - inconsistente bronverwijzingen tussen tekst en chips

### Implementatieplan

#### 1. Canonieke URL-normalisatie in de backend
**Bestand:** `supabase/functions/homepage-coach/index.ts`

- Voeg één helper toe die alle externe URL’s canoniek maakt:
  - `https://` toevoegen als het schema ontbreekt
  - domein veilig parsen
  - ongeldige URL’s weggooien
- Gebruik die helper overal waar `trusted_sources` naar `verified_links` wordt omgezet.

Doel: nooit meer een chip met `href: "voraad.nl"` of `href: "onderwijsloket.com"`.

#### 2. `computePublicLinks()` echt whitelist-gestuurd en intent-relevant maken
**Bestand:** `supabase/functions/homepage-coach/index.ts`

- Vervang de huidige logica “pak actieve trusted sources als er externe keywords zijn”.
- Maak selectie op basis van vraagtype/intentie en categorie, bijvoorbeeld:
  - salaris → alleen salaris/beleid-bronnen
  - kosten → alleen kosten/subsidie-bronnen
  - routes → routes/opleiding
  - bevoegdheid → toelating/kwaliteit
- Beperk externe chips tot 1-2 echt relevante bronnen.
- Laat irrelevante fallback-links zoals “Routes en opleidingen” weg bij bron-/feitenvragen, tenzij de vraag ook echt navigatie vraagt.

Doel: chips moeten inhoudelijk kloppen met de vraag, niet alleen “gewitlist” zijn.

#### 3. URL-sanitizer op de antwoordtekst zelf
**Bestand:** `supabase/functions/homepage-coach/index.ts`

- Voeg na de LLM-call en vóór streaming een tweede validatiestap toe:
  - detecteer URLs en bare domains in `rawDraft`
  - normaliseer ze
  - check ze tegen de whitelist
  - verwijder of vervang ongewitliste externe URL’s
- Ruim expliciet patronen op zoals:
  - `(https://...)`
  - bare domains in lopende tekst
- Stuur het model ook strakker aan:
  - geen losse externe URL’s uitschrijven
  - alleen interne markdown-links voor sitepagina’s
  - externe bronnen liever via `verified_links` chips laten lopen

Doel: hallucinatoire of rommelige URL’s verdwijnen niet alleen uit chips, maar ook uit de antwoordtekst zelf.

#### 4. Frontend hardenen tegen foute backend-links
**Bestanden:**
- `src/components/chat/PublicChatWidget.tsx`
- `src/components/chat/AuthenticatedChatOverlay.tsx`

- Voeg een kleine guard toe:
  - render externe chip alleen als `href` een absolute `http/https` URL is
  - anders niet tonen
- Laat de authenticated general-mode dezelfde meta-parsing gebruiken als de public widget (`parseStructuredMeta`), zodat de weergave consistent wordt.

Doel: de UI toont nooit meer kapotte anchors, ook niet als de backend ooit nog ongeldige data terugstuurt.

#### 5. Markdown-opruiming voor nette inline bronverwijzingen
**Bestand:** `src/utils/normalizeMarkdown.ts`

- Breid de normalisatie uit voor gevallen als `(...https://...)`, zodat die niet als lelijke losse URL tussen haakjes in de bubble blijven staan.
- Dit is een extra vangnet; de primaire fix blijft backend-sanitatie.

Doel: nette, leesbare chatantwoorden zonder URL-ruis.

#### 6. Recidive voorkomen in backoffice
**Bestand:** `src/components/backoffice/TrustedSourcesTab.tsx`

- Normaliseer URL’s al bij invoer/opslag:
  - schema toevoegen als het ontbreekt
  - invalide invoer blokkeren
- Optioneel: bestaande records eenmalig backfillen/opschonen, omdat de tabel nu gemixte waarden bevat.

Doel: nieuwe trusted sources kunnen dit probleem niet opnieuw introduceren.

### Verwachte uitkomst
Na deze fix:
- zijn externe chips altijd absolute, geldige links
- zijn chips relevant voor de vraag
- verdwijnen losse/hallucinatoire externe URL’s uit de antwoordtekst
- blijven internal links netjes klikbaar
- gedragen public widget en authenticated “Algemeen” zich hetzelfde

### Bestanden in scope
- `supabase/functions/homepage-coach/index.ts`
- `src/components/chat/PublicChatWidget.tsx`
- `src/components/chat/AuthenticatedChatOverlay.tsx`
- `src/utils/normalizeMarkdown.ts`
- `src/components/backoffice/TrustedSourcesTab.tsx`

### QA na implementatie
Ik zou daarna expliciet deze flows verifiëren:
1. “Hallo” → korte groet, geen zichtbare link-ruis
2. “Wat verdient een leraar?” → alleen relevante bronchips, geen losse URL tussen haakjes
3. “Wat kost zij-instroom?” → alleen kosten/subsidie-bronnen
4. “Ik wil vacatures zien” → interne vacaturelink, geen irrelevante externe bron
5. Zelfde tests in zowel public widget als ingelogde “Algemeen”-tab
