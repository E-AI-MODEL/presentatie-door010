# Twee soorten zekerheid, twee subtiele signalen

Splitsen in **één rustig achtergrondsignaal** (begripszekerheid) en **één expliciete indicator** (antwoord-betrouwbaarheid). Niks dubbelop.

---

## Signaal 1 — Chatbox/bubble kleur = "Begrijp ik je goed?" (phase_confidence)

Subtiel, ambient, niet hard. Past op de **AI-bubble achtergrond** of de **rand van de chat-overlay**, niet als chip.

- **`phase_confidence ≥ 0.75`** → geen accent (neutrale `bg-muted`).
- **`0.55 – 0.74`** → bubble krijgt subtiele groene wash (`bg-primary/5`, border `border-primary/15`).
- **`< 0.55`** → bubble krijgt subtiele amber wash (`bg-amber-50` / `border-amber-200`).
- **Geen tekst, geen tooltip** op de bubble zelf. Pure ambient feedback.

Toepassen op de **laatste AI-bubble** in `AuthenticatedChatOverlay.tsx` (regel ~824–840), conditioneel via `lastConfidence`.

---

## Signaal 2 — Aparte indicator = "Hoe betrouwbaar is dit antwoord?" (reflection)

Eén compacte chip onder het antwoord, **alleen als er een reflection-signaal is** (anders niets zichtbaar = clean).

- **Reflection passed + geen issues** → niets tonen (default = goed).
- **Reflection had issues** → chip met dot + label:
  - `● Mogelijk onvolledig` (amber dot)
  - Hover-tooltip toont de concrete issues uit `reflectionWarning` (max 2 zinnen).
- **Geen percentage** op deze (reflection is pass/fail, geen score).

Vervangt regels 918–942 in `AuthenticatedChatOverlay.tsx`. De huidige gecombineerde chip met "Nog niet zeker / Redelijk zeker / Zeker" verdwijnt.

---

## Resultaat voor de gebruiker

| Situatie | Wat zie je |
|---|---|
| Begrijp je goed + antwoord oké | Niets bijzonders (rustig) |
| Begrijp je matig + antwoord oké | Bubble licht groene wash, geen chip |
| Begrijp je niet goed + antwoord oké | Bubble amber wash, geen chip |
| Antwoord twijfelachtig | Chip `● Mogelijk onvolledig` onder bericht (met hover) |
| Beide problemen | Bubble amber wash + chip eronder |

---

## Implementatie (1 bestand)

`src/components/chat/AuthenticatedChatOverlay.tsx`:
- Regels 824–840: voeg `confidenceBubbleClass` toe aan de assistant-bubble className.
- Regels 918–942: vervang door minimale reflection-only chip, alleen bij `reflectionWarning?.length`.
- Tooltip via shadcn `Tooltip`.

---

## Exit-voorwaarde (live test)

1. Stel een vage vraag → laatste AI-bubble krijgt amber/groene wash (geen chip).
2. Stel een duidelijke vraag → bubble blijft neutraal, geen chip.
3. Forceer reflection-issue (vraag iets buiten kennisdomein) → chip `● Mogelijk onvolledig` verschijnt onder dat bericht, hover toont uitleg.
4. Geen dubbele indicatoren meer; geen `"Nog niet zeker / Redelijk zeker / Zeker"` tekstlabel meer.

---

## Memory-update na implementatie

`mem://design/chat-ui`: vervang regel over zekerheidsindicator door:
> Twee signalen, gescheiden: bubble-tint = begripszekerheid (ambient, geen tekst); kleine chip "Mogelijk onvolledig" = reflection (alleen bij issue, met hover).
