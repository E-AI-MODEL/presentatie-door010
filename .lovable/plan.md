## Wat ik in het admin-dashboard zie

`/backoffice` → **Overzicht** rendert per-fase groepen (`UserOverviewTable.tsx`). Probleem nu:

1. **Alle 5 fase-groepen staan default open** — bug in `openGroups[phase] !== false` (alleen `interesseren` is expliciet `true`, de rest is `undefined` → ook `!== false` → open). Met 84 kandidaten betekent dat ~84 rijen direct uitgeklapt → de hele viewport is 1 lange lijst.
2. **Open groepen hebben geen max-hoogte** — 1 groep (56 in "Interesseren") duwt de andere 4 groepen ver onder de fold; je kan niet zien dat ze bestaan zonder eindeloos scrollen.
3. **Rechter detailpaneel staat leeg** (`Selecteer een kandidaat`) → enorme witruimte zolang er geen selectie is.
4. **Rijen zijn breed** — aparte kolom voor telefoon, aparte kolom voor "Docs", aparte voor datum → veel horizontale ruimte voor weinig info, terwijl de detail-kolom maar 1/3 van de breedte krijgt.

## Compacter maken (alleen `UserOverviewTable.tsx` + 2 regels in `Backoffice.tsx`)

### 1. Default-staat van groepen omdraaien
- **Alleen de eerste niet-lege groep** start open (meestal "Interesseren"). De rest dicht.
- "Klap alles in/uit" toggle naast de Filters-knop (één klik → alles open of alles dicht).

### 2. Per groep een max-hoogte met eigen scroll
- Body van een open groep: `max-h-[320px] overflow-y-auto`.
- Header sticky binnen die scroll (je houdt de fase-pill in beeld).
- Resultaat: 5 groepen passen tegelijk op één scherm, elk met eigen mini-scroll.

### 3. Rijen denser (h-9 → h-8) en kolommen samenvoegen
- "Contact"-kolom weg → telefoon als klein icoon-chip naast de naam (alleen als ingevuld).
- "Docs"-kolom blijft (CV + test-icoontjes, minimaal), maar zonder eigen header-cel in lijstmodus.
- "Activiteit"-datum smaller (`d MMM` zonder uur).
- Action-knop (chat-icoon) blijft uiterst rechts.

### 4. Rechter detail-paneel adaptive breedte
- In `Backoffice.tsx renderSection() case 'overview'`:
  - **Geen kandidaat geselecteerd** → lijst pakt volle breedte (`xl:col-span-3`), geen lege placeholder.
  - **Kandidaat geselecteerd** → lijst `xl:col-span-1`, detail `xl:col-span-2` (was 2/1 → wordt 1/2: véél meer ruimte voor user-info, dat is wat je vroeg).

### 5. Kleine polish
- Group header krijgt naast het aantal ook een mini-balk met "ongelezen" (•) als één van de kandidaten ongelezen berichten heeft → snel scannen waar actie nodig is.
- Lege groepen (0) tonen we niet (al zo).

## Buiten scope

- Geen schema-wijzigingen.
- Geen verandering aan andere tabs (Afspraken, Meldingen, Gesprekken).
- Geen redesign van de detail-/chatpanelen zelf — alleen meer ruimte ervoor.

## Effect

- Boven de fold: alle 5 fases zichtbaar + toolbar + KPI-strip.
- Detail-paneel krijgt 2/3 i.p.v. 1/3 van de breedte zodra je iemand selecteert.
- 1 klik om alle groepen in of uit te klappen.
