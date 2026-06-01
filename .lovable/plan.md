# Fix-plan: AI bugs + warning duplicatie + lege placeholders

Aanpak in 6 stappen. Elke stap heeft een **harde exit-voorwaarde** die ik verifieer voor ik doorga.

---

## Stap 1 — Zichtbare leaks naar kandidaat (Critical 3 + 4 + warning-duplicatie)

**Wat:**
- `src/components/profile/ProfileTimeline.tsx`: herschrijf alle `description` strings die "fase" bevatten (regels 32, 48, 64, …) naar handelingsgerichte tekst zonder fase-woord.
- Idem: hernoem alle `label: "Kennisbank"` / `"Subsidie-info"` etc. die naar `/kennisbank` linken (regels 61, 75, 92, 106) — labels worden "Meer informatie", "Routegids", "Sollicitatietips", "Praktische zaken"; href blijft maar label bevat geen verboden term.
- `src/components/chat/AuthenticatedChatOverlay.tsx` regels 908-939: **merge** de twee waarschuwingen. Bij low confidence (<0.55) toon alleen één element (de "Twijfel"-chip krijgt subtitel "antwoord mogelijk onvolledig"); de aparte ⚠️-balk vervalt. Bij medium/high alleen confidence chip zonder warning.
- Verwijder of hernoem "Twijfel" naar neutrale tekst ("Nog niet zeker") want het is een verboden-term-buurt en oogt als alarm.

**Exit-voorwaarde:**
- `rg -n "fase|Kennisbank|kennisbank" src/components/profile/ProfileTimeline.tsx` → 0 hits in zichtbare tekstvelden.
- Visuele check screenshot: chat met low-confidence antwoord toont **één** subtiele indicator, geen dubbele warning.
- `rg -n "Twijfel" src/components/chat` → 0 hits.

---

## Stap 2 — Chip-limieten (Critical 1 + 2)

**Wat:**
- `supabase/functions/doorai-chat/index.ts:1056` → `uiLinks.slice(0, 1)`
- `supabase/functions/doorai-chat/index.ts:1278` → `themesToActions(themes, 1)`
- `supabase/functions/homepage-coach/index.ts:216` → `.slice(0, 1)`
- `supabase/functions/homepage-coach/index.ts:469` → `themesToActions(themes, 1)`
- `src/components/chat/AuthenticatedChatOverlay.tsx:362, 532` → `.slice(0, 1)`
- `src/components/chat/PublicChatWidget.tsx:253, 268` → `.slice(0, 1)`

**Exit-voorwaarde:**
- Live test in preview: stel een vraag, screenshot het antwoord, tel chips → exact ≤1 action + ≤1 link.
- `rg -n "slice\(0, [2-9]" supabase/functions src/components/chat` → 0 hits voor chip-arrays.

---

## Stap 3 — Live state gaps (High 4 + 5)

**Wat:** voeg `notifyProfileUpdated()` toe na elke succesvolle `profiles.update()` in:
- `src/components/chat/AuthenticatedChatOverlay.tsx` regels 214, 266, 371
- `src/components/profile/InterestTest.tsx:168`
- `src/components/profile/AvatarUpload.tsx:89, 122`
- `src/components/profile/CVUpload.tsx:95, 127`

**Exit-voorwaarde:**
- `rg -n "profiles.*\.update\(" src/components | xargs rg -lL "notifyProfileUpdated"` → 0 (alle update-files importeren de helper).
- Manuele test: upload avatar → Dashboard avatar update binnen 1s zonder reload.

---

## Stap 4 — known_slots persistentie + sanitizer-gaps (High 1 + 6, Medium 3 + 4)

**Wat:**
- `supabase/functions/doorai-chat/index.ts` na regel 1288: schrijf `correctedSlots` terug naar DB met `adminClient.from("profiles").update({ known_slots: mergedSlots }).eq("user_id", uid)`. Merge met server-side verse `known_slots` zodat client niet kan overschrijven.
- `src/utils/sanitizeClient.ts:22-28`: vul `FORBIDDEN_BARE` aan met `fase`, `intake`, `slot`, `detector`, `scenario` (5 ontbrekende).
- `doorai-chat/index.ts:1306-1311`: sanitize `phaseSuggestion?.message` met `sanitizeAssistantText()` voor het in `uiPayload` gaat.
- `doorai-chat/index.ts` `resolveSystemPrompt` (~895-918): run `sanitizeAssistantText()` over elke DB `prompt_override` vóór concatenatie.

**Exit-voorwaarde:**
- Chat-turn met sector-keuze → reload pagina → `known_slots` in DB bevat de waarde (verifieer via `supabase--read_query`).
- `rg -n "FORBIDDEN_TERMS|FORBIDDEN_BARE" src/utils/sanitizeClient.ts` toont alle 12 termen.

---

## Stap 5 — Lege placeholders & hallucinaties (ervaringsverhalen / podcasts) + High 2 + 3

**Wat:**
- `supabase/functions/doorai-chat/index.ts` `DOORAI_CORE` (~666): voeg harde regel toe: *"Noem nooit content-vormen als 'ervaringsverhalen', 'podcasts', 'video's' of vergelijkbaar tenzij een concrete titel/URL voor die vorm in de bronnen staat. Bij twijfel: weglaten."*
- Idem in `homepage-coach/index.ts` `SITE_GUIDE_PROMPT` (~280).
- Vervang "fase" in `homepage-coach:295, 297` door "orientatiestadium".
- Vervang `## Interne kennisbank` in `doorai-chat:231, 305` door `## Interne bronnen`.
- Voeg in `_shared/sanitize.ts` een regex toe die zinnen verwijdert met `\b(ervaringsverhalen|podcasts?|video['']?s)\b` waarvoor geen URL of `[…]` in dezelfde zin staat (defensive net).
- Peildatum-string `mogelijk verouderd, laatst gecheckt …`: voeg regex toe aan sanitizer.

**Exit-voorwaarde:**
- 3 testvragen die historisch "ervaringsverhalen/podcasts" triggerden: geen van die woorden in output tenzij links/titel meegegeven.
- `rg -n '"fase"|## Interne kennisbank' supabase/functions` → 0 hits.

---

## Stap 6 — Medium/Low restjes (M2, L1, L2, L3)

**Wat:**
- Verwijder `/dashboard` uit `homepage-coach` `INTERNAL_LINKS` (publiek bezoeker heeft daar niets te zoeken).
- `doorai-chat:13` comment opschonen (em-dash + "fase" eruit).
- `src/components/profile/ProfileHero.tsx:86` fallback: `phaseLabels[…] || "Aan het ontdekken"`.
- `AuthenticatedChatOverlay.tsx:491-495`: verwijder client-side `profileContext` uit homepage-coach request body (server haalt zelf op).

**Exit-voorwaarde:**
- Code-review pass: `rg` op alle low-bug-files toont geen restklacht.
- Volledige smoke-test: login als test-user, chat 3 vragen, edit profile, herlaad → geen warnings, geen leaks, één chip-max gerespecteerd.

---

## Technical notes
- Geen DB migraties nodig.
- Geen nieuwe packages.
- Geen wijzigingen aan `client.ts`, `themes.ts` of SSOT-JSONs.
- `_shared/sanitize.ts` wordt door zowel `doorai-chat` als `homepage-coach` geïmporteerd; één edit dekt beide.
- Edge functions worden automatisch gedeployed.

## Out of scope
- Geen UI re-design.
- Geen wijziging aan FAQ-DB inhoud of trusted_sources.
- Geen wijziging aan phase-detector scoring.

---

**Werkwijze:** ik doe Stap 1 → verifieer exit → Stap 2 → enz. Bij elke stap meld ik kort "exit OK" met bewijs (rg-output of screenshot), pas dan ga ik door.
