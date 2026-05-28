## Doel
In `DetectorDebugTab` (backoffice → DoorAI gespreksanalyse) staan nu per gespreksregel **vier** badges: fase, twijfel/zeker, confidence %, plus tijd. Daarnaast bovenin nog "X met twijfel". Te druk en dubbelop. Eén duidelijke twijfel-indicator volstaat.

## Wat blijft
- **Per regel**: alleen de fase-badge (context) + één **twijfel-indicator** (amber pill met `AlertTriangle`, tekst "twijfel · 47%"). Wordt **alleen getoond als `uncertain === true`**. Bij zekere regels geen badge → rustiger beeld, twijfel valt direct op.
- **Confidence-percentage** wordt opgenomen ín de twijfel-badge (alleen zichtbaar bij twijfel, waar het er toe doet). Voor zekere regels is het getal ruis.
- **Tijdstempel** blijft rechts (kleine muted tekst, geen badge).
- **Bovenin**: alleen teller "X gesprekken · Y met twijfel" als platte tekst, niet meer als twee aparte badges.

## Wat weg gaat
- Groene "zeker" badge per regel.
- Losse confidence-% badge per regel.
- De twee badges bovenin (`X actieve gesprekken` + `X met twijfel` als Badge-componenten).
- Helper `confColor` (niet meer nodig).

## Andere badges in de app
Niet aanraken. Twijfel-concept bestaat alleen in `DetectorDebugTab`. Overige Badges (fases, appointment-status, alerts, sectoren, categories) hebben elk een eigen functie en zijn al consistent.

## Bestand
- `src/components/backoffice/DetectorDebugTab.tsx`
