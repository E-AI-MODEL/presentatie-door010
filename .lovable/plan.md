# Plan: DOOR Rotterdam als landelijke AI-demo

## Doel
Rotterdam blijft HET voorbeeld. We maken een lichte demo-versie van de site waarin drie AI-componenten centraal staan en feilloos werken, zodat andere onderwijsregio's zien hoe AI in de praktijk wordt toegepast.

## Modelkeuze
- **Plan & redenering:** google/gemini-3-pro-preview
- **Uitvoering (code + AI runtime in de app):** google/gemini-3-flash-preview (huidige default in homepage-coach en doorai-chat blijft staan)

## De drie AI-componenten in de spotlight
1. **DoorAI public chat** (`homepage-coach`) — warme, action-first coach met betrouwbare bronnen en chips
2. **DoorAI kandidaat-dashboard** (`doorai-chat` + dashboard) — gepersonaliseerd, smart topic menu, aanbevolen content
3. **Events/vacatures scraping** (`scrape-events` via Firecrawl) — automatisch verse agenda + vacatures

## Aanpak: "light versie" van de site

### 1. Homepage strippen tot demo-showcase
Bestand: `src/pages/Index.tsx` + `src/components/home/*`
- Hero behouden, maar duidelijke "Landelijke demo" badge + ondertitel: "Zo zet onderwijsregio Rotterdam AI in voor zij-instromers"
- `JourneySection` vervangen door een **"AI in actie"-sectie** met 3 kaarten — één per component, met live mini-preview/CTA
- `TestimonialsSection` verbergen of vervangen door een korte uitleg "Voor andere regio's" (1 alinea + contact-CTA)
- Footer behoudt links, maar voegt "Demo voor onderwijsregio's" disclaimer toe

### 2. Navigatie afslanken
Bestand: `src/components/layout/Header.tsx`
- Verberg of bundel pagina's die niet tot de AI-demo behoren (Opleidingen, Kennisbank blijven, maar minder prominent)
- Primair menu: **Home · DoorAI · Dashboard · Agenda · Vacatures · Inloggen**
- Voeg een subtiele "Demo" tag toe naast het logo

### 3. Dedicated demo-landingspagina `/demo`
Nieuw: `src/pages/Demo.tsx` (route in `App.tsx`)
- Uitleg voor andere regio's: wat doen we, welke AI, welke stack
- 3 secties — één per AI-component met:
  - korte uitleg ("Wat doet het?")
  - "Hoe werkt het technisch?" (1 alinea, leesbaar voor niet-tech)
  - directe CTA naar live preview (chat openen / dashboard demo-login / agenda-pagina)
- Onderaan: contactblok "Wil je dit ook in jouw regio?"

### 4. AI-componenten hardenen (van plan.md openstaande punten)
We pakken de openstaande pipeline-fixes uit het vorige plan af, want demo = alles moet kloppen:
- `homepage-coach`: canonieke URL-normalisatie, intent-gestuurde chip-selectie, URL-sanitizer op antwoordtekst
- Frontend guards in `PublicChatWidget` en `AuthenticatedChatOverlay` voor kapotte hrefs
- `normalizeMarkdown` uitbreiden voor `(...https://...)`-patronen
- `TrustedSourcesTab` URL-normalisatie bij invoer

### 5. Demo-modus zichtbaar maken
- Subtiele "DEMO" badge linksboven (niet storend, wel duidelijk)
- Op `/demo` een "Probeer als kandidaat"-knop die auto-login doet met een demo-account (Rotterdam testdata)

### 6. Events scraping als showcase
Bestand: `src/components/events/ScrapedEventsList.tsx` + `supabase/functions/scrape-events`
- Toon laatste scrape-tijdstip prominent ("Laatst bijgewerkt: 2 min geleden via Firecrawl")
- Op `/events`: kleine "Hoe werkt dit?" tooltip die uitlegt dat AI dit automatisch ophaalt

## Wat we NIET doen
- Geen aparte regio-routes, geen theme-tokens per regio, geen multi-tenant database
- Geen kopieën van de site voor andere regio's
- Geen wijzigingen aan auth/rollen of database-schema
- Branding blijft Rotterdam Green & Magenta

## Bestanden in scope
- `src/pages/Index.tsx` (homepage afslanken)
- `src/pages/Demo.tsx` (nieuw)
- `src/App.tsx` (route toevoegen)
- `src/components/home/JourneySection.tsx` (vervangen door AI-showcase)
- `src/components/home/TestimonialsSection.tsx` (vervangen of verbergen)
- `src/components/layout/Header.tsx` (menu afslanken + demo-badge)
- `src/components/layout/Footer.tsx` (demo-disclaimer)
- `src/components/events/ScrapedEventsList.tsx` (laatste-update timestamp)
- `supabase/functions/homepage-coach/index.ts` (pipeline hardening)
- `src/components/chat/PublicChatWidget.tsx` (href guards)
- `src/components/chat/AuthenticatedChatOverlay.tsx` (href guards + parser)
- `src/utils/normalizeMarkdown.ts` (URL-opruim)
- `src/components/backoffice/TrustedSourcesTab.tsx` (URL-normalisatie input)

## Volgorde van uitvoering
1. AI-pipeline hardenen (chat-kwaliteit eerst, want dat is de showcase)
2. `/demo` landingspagina bouwen
3. Homepage afslanken naar AI-showcase
4. Header/Footer demo-tagging
5. Events: scrape-timestamp tonen
6. QA: doorloop van een "regio-bezoeker" — landing → /demo → chat → dashboard → events

## QA-scenario's na implementatie
1. Bezoeker landt op `/` → ziet meteen "AI in actie" met 3 componenten
2. Klikt op `/demo` → begrijpt binnen 30s wat Rotterdam doet en hoe
3. Test chat: "Wat verdient een leraar?" → alleen relevante chips, geen losse URL's
4. Demo-login → ziet dashboard met smart topic menu en aanbevolen content
5. `/events` → ziet verse data + Firecrawl-attributie
