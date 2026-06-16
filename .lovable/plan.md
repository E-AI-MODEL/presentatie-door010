## Doel

Eén persoonlijke hub op `/dashboard` waarin "wat doe ik nu" (huidige dashboard) en "wie ben ik" (huidige profiel) samenkomen. Consistente visuele taal, compacter, en het verschil tussen de twee pagina's verdwijnt.

## Wat verandert er voor de gebruiker

- `/dashboard` wordt de enige hub. Bovenaan: identity-hero + fase-progress + "volgende stap" CTA (zoals nu).
- Daaronder één tab-rij met **vier tabs**:
  1. **Vandaag** — quick actions, topic-menu, aanbevolen content (huidige dashboard-content)
  2. **Profiel** — persoonlijk, sector, fase (uit huidige Profile)
  3. **Documenten** — interesse-test, CV, notities
  4. **Activiteit** — afspraak, opgeslagen vacatures/events, timeline
- `/profile` blijft werken maar redirect naar `/dashboard?tab=profiel` (zodat oude links, headers en AI-verwijzingen niet breken).
- Sticky save-bar verschijnt alleen wanneer een wijziging onopgeslagen is, alleen in editable tabs (Profiel/Documenten).

## Visuele consistentie (redesign light)

Eén card-recept dat overal terugkomt:

- `rounded-2xl border border-border/60 bg-card`
- Subtielere schaduw: vervang `shadow-door` op tiles door `shadow-sm hover:shadow-md transition`
- Card-header: kleine icoon-chip (8x8, `bg-primary/10 rounded-lg`) + titel in `text-sm font-semibold` (geen uppercase-tracking meer overal — alleen op section-eyebrows)
- Card-padding gelijk: `p-4 md:p-5`
- Eyebrow-stijl (`text-[10px] uppercase tracking-wider`) alleen nog voor section-labels (niet binnen tiles)
- Tabs: zelfde stijl als nu, maar volle breedte met 4 kolommen i.p.v. 2/3
- Identity-hero blijft, maar Phase-progress wordt iets compacter en visueel onderdeel van de hero (zelfde card-achtergrond, geen aparte band)

## Technisch

**Nieuwe/aangepaste bestanden**

- `src/pages/Dashboard.tsx` — wordt de hub. Bevat alle state/logica van huidige Profile (form-state, tile-handlers, save) + huidige dashboard-content. Tabs uitbreiden naar 4. Leest `?tab=` uit URL.
- `src/pages/Profile.tsx` — wordt een mini-component die `<Navigate to="/dashboard?tab=profiel" replace />` doet. Niet verwijderen i.v.m. bestaande imports/routes.
- `src/components/dashboard/HubHero.tsx` (nieuw) — combineert identity-hero + compactere phase-progress in één card-achtige sectie.
- `src/components/profile/tiles/*` — bestaande tile-componenten (NotesTile, CVUpload etc.) krijgen een lichte styling-pass: zelfde card-recept, kleinere headers. Logica blijft 1-op-1.
- Header-nav: link "Profiel" wijst naar `/dashboard?tab=profiel` (i.p.v. `/profile`). "Dashboard" verdwijnt uit nav (of wordt "Mijn hub").

**Geen wijzigingen aan**

- Backend / schema / RLS
- AI edge-functions, sanitizer, FORBIDDEN_PATTERNS (interne paden blijven verboden in AI-prose)
- Tile-componenten zelf qua functionaliteit
- Backoffice

## Out of scope

- Draggable functie moet weg. 
- Nieuwe content / nieuwe tiles
- Mobile-specifieke redesign moet daar waar nodig ook worden meegenomen. 

## Risico's

- AI/sanitizer noemt `/profile` als verboden path — redirect houdt oude AI-suggesties geldig, maar prompts blijven `/profile` blokkeren conform geheugen. Geen actie nodig.
- Sticky save-bar moet alleen op editable tabs verschijnen, anders verwarrend op "Vandaag" tab.  
  
**Zorg voor goede exit voorwaarde en check die na je build. Hierna start je direct een plan die gaat over deze vragen :**   
  
waarom kan ik in chat geen topics (via burgermenu zoals voorheen) of andere "back end" achtige structuren niet meer aanklikken / connecten met DOORAI ?!  Check verder ook verdiepend stijl en toon. het kan bijv. goed zijn om chuncks context die toch al (gedeeltelijk) in de prompt mee gaan te gebruiken in de tekst. dat moet wel minimaal en subtiel.   
  
Indien nodig pas je eerst het plan aan en neem je dit mee.   
  
  
GO!
-   
  
