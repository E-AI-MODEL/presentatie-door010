## Probleem

Op de homepage (`HeroSection`) overschrijdt de groene CTA-button "Je eerste stap richting het Rotterdamse onderwijs" de viewport-breedte op smartphone. De button gebruikt `size="lg"` met `px-6` en `whitespace-nowrap` (shadcn default), waardoor de lange tekst horizontale scroll veroorzaakt.

Daarnaast staat de h1 op `text-4xl` op mobile (geen `sm:` breakpoint), waardoor de drie inline-block highlight-blokken hoog en breed worden.

## Fix in `src/components/home/HeroSection.tsx`

1. **CTA-button**: voeg `whitespace-normal text-left h-auto py-3 max-w-full` toe zodat de label op twee regels mag breken op smal scherm. Container krijgt `w-full sm:w-auto`.
2. **H1**: schaal naar `text-3xl sm:text-4xl md:text-5xl lg:text-6xl` zodat de highlight-blokken niet meer overlopen. Voeg `break-words` toe als safety.
3. **Section container**: voeg `overflow-hidden` toe op de `<section>` zodat eventuele toekomstige overflow nooit horizontale page-scroll triggert.

Geen andere bestanden raken. Visuele lay-out op desktop blijft identiek (alleen `sm:` en hoger).
