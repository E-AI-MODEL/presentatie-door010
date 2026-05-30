import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PageHero } from "@/components/shared/PageHero";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MessageCircle,
  LayoutDashboard,
  CalendarSearch,
  ArrowRight,
  Sparkles,
  Mail,
  CheckCircle2,
} from "lucide-react";

const sections = [
  {
    icon: MessageCircle,
    eyebrow: "Coach",
    title: "DOORai — directe AI-coach",
    what: "Een slimme chat op elke pagina die bezoekers meteen verder helpt met vragen over routes, salaris, opleidingen en subsidies. De coach stelt maximaal één vervolgvraag en geeft altijd een concrete actie mee.",
    bullets: [
      "Warm en duidelijk, zonder jargon",
      "Beantwoordt op basis van geverifieerde bronnen",
      "Stuurt je gericht naar de juiste vervolgstap",
    ],
    cta: { label: "Open de coach", action: "chat" as const },
  },
  {
    icon: LayoutDashboard,
    eyebrow: "Dashboard",
    title: "Persoonlijk kandidaat-dashboard",
    what: "Ingelogde kandidaten krijgen een dashboard dat zich aanpast aan waar ze staan in hun route. De inhoud, suggesties en vervolgstappen bewegen mee met de situatie.",
    bullets: [
      "Persoonlijk afgestemd op jouw profiel",
      "Slim menu met de juiste onderwerpen",
      "Adviseur kan meekijken en bijsturen",
    ],
    cta: { label: "Bekijk dashboard", href: "/dashboard" },
  },
  {
    icon: CalendarSearch,
    eyebrow: "Agenda & vacatures",
    title: "Altijd actuele agenda en vacatures",
    what: "Events en vacatures worden automatisch opgehaald uit betrouwbare regionale en landelijke bronnen, en in de huisstijl van Rotterdam getoond.",
    bullets: [
      "Geen handmatig contentbeheer meer",
      "Bronvermelding altijd zichtbaar",
      "Altijd actueel aanbod, ook 's avonds",
    ],
    cta: { label: "Bekijk agenda", href: "/events" },
  },
];

export default function Demo() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <PageHero
          title="Landelijke demo"
          titleHighlight="AI voor onderwijsregio's"
          subtitle="Zo zet onderwijsregio Rotterdam AI in om kandidaten te begeleiden van eerste interesse tot instroom in het onderwijs. Drie componenten, één samenhangende ervaring."
        >
          <div className="flex flex-wrap gap-3">
            <Button size="lg" variant="secondary" asChild>
              <Link to="/">
                <Sparkles className="mr-2 h-4 w-4" />
                Bekijk de live site
              </Link>
            </Button>
          </div>
        </PageHero>

        <section className="py-16 md:py-20 bg-white">
          <div className="container max-w-5xl space-y-16">
            {sections.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="grid md:grid-cols-[auto_1fr] gap-6 md:gap-10 items-start"
                >
                  <div className="bg-primary/10 rounded-3xl p-5 w-fit">
                    <Icon className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                      {s.eyebrow}
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4 uppercase tracking-tight">
                      {s.title}
                    </h2>

                    <div className="mb-6">
                      <p className="text-foreground leading-relaxed">{s.what}</p>
                    </div>

                    <ul className="space-y-2 mb-6">
                      {s.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>

                    {"action" in s.cta ? (
                      <Button
                        onClick={() =>
                          window.dispatchEvent(new CustomEvent("openDOORaiChat"))
                        }
                      >
                        {s.cta.label}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button asChild>
                        <Link to={s.cta.href}>
                          {s.cta.label}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="py-16 md:py-20 bg-primary">
          <div className="container max-w-3xl text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground mb-4 uppercase tracking-tight">
              Wil je dit ook in jouw regio?
            </h2>
            <p className="text-primary-foreground/90 mb-8 max-w-xl mx-auto">
              Deze demo is gebouwd voor onderwijsregio Rotterdam. We delen graag hoe je dit kunt inzetten voor jouw regio — van pilot tot uitrol.
            </p>
            <Button size="lg" variant="secondary" asChild>
              <a href="mailto:info@onderwijsloketrotterdam.nl?subject=Demo%20AI%20onderwijsregio">
                <Mail className="mr-2 h-4 w-4" />
                Neem contact op
              </a>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
