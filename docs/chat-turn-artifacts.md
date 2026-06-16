# Chat turn artifacts

Deze repo gebruikt voortaan een vast contract voor alles wat onder een AI-antwoord verschijnt.

## Waarom

De oude chatflow had meerdere rails naast elkaar:

- action chips
- link chips
- confidence pills
- phase confirmation cards
- badges of pill-achtige statuslabels

Daardoor leek alles op een chip, terwijl niet alles klikbaar was en niet alles dezelfde betekenis had. Dat zorgde ervoor dat chips elkaar konden wegdrukken of dat links, status en vragen door elkaar gingen lopen.

## Contract

Een assistantbericht mag `artifacts: ChatTurnArtifact[]` hebben.

De toegestane soorten zijn:

- `question`: klikbare vervolgvraag
- `source`: klikbare bron of interne pagina
- `status`: niet-klikbare status of confidence
- `decision`: besliskaart voor fase-overgang of expliciete bevestiging

## Regels

1. Een vraag is een knop.
2. Een bron is een bronlink of paginalink.
3. Status is nooit klikbaar.
4. Confidence wordt niet als chip gerenderd.
5. Een `decision` vervangt losse vraag- en bronchips.
6. Twijfel wordt gemapt naar de vraag `Help me kiezen`.
7. Artifacts horen bij het assistantbericht zelf, niet bij een globale bottom rail.
8. Nieuwe chat-UI code mag geen nieuwe `latestActions` of `latestLinks` rails introduceren.

## Backward compatibility

Tijdens de migratie mogen backends nog `actions`, `links`, `verified_links`, `primary_followup` of `phase_suggestion` sturen. De frontend normaliseert die tijdelijk naar `ChatTurnArtifact[]`.

De eindstaat is dat beide edge functions `event: turn_meta` sturen en dat `[DONE]` altijd het laatste SSE-event is.

## Lovable-afspraak

Lovable mag tekst, styling en kleine componenten aanpassen, maar de chatrail moet via `ChatTurnArtifact` blijven lopen. Geen losse chiprails terug toevoegen.
