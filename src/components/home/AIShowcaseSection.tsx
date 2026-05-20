import { motion } from "framer-motion";
import { MessageCircle, LayoutDashboard, CalendarSearch, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const components = [
  {
    icon: MessageCircle,
    title: "DOORai Coach",
    badge: "Publieke chat",
    description:
      "Een AI-coach die bezoekers direct antwoord geeft op vragen over zij-instroom, opleidingen en salaris — met gecontroleerde bronnen.",
    cta: { label: "Open de coach", action: "chat" as const },
  },
  {
    icon: LayoutDashboard,
    title: "Persoonlijk Dashboard",
    badge: "Kandidaat AI",
    description:
      "Voor ingelogde kandidaten: AI bepaalt waar je staat in je route en serveert passende acties, content en vacatures.",
    cta: { label: "Bekijk dashboard", href: "/dashboard" },
  },
  {
    icon: CalendarSearch,
    title: "Verse Agenda & Vacatures",
    badge: "Auto-scraping",
    description:
      "AI-agents halen automatisch nieuwe events en vacatures op uit betrouwbare bronnen. Geen redactiewerk meer.",
    cta: { label: "Bekijk agenda", href: "/events" },
  },
];

export function AIShowcaseSection() {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="container">
        <div className="max-w-2xl mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            AI in actie · Rotterdam
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3 uppercase tracking-tight">
            Drie <span className="text-primary">AI-componenten</span> die het verschil maken
          </h2>
          <p className="text-muted-foreground">
            Een live voorbeeld van hoe onderwijsregio Rotterdam AI inzet om kandidaten te begeleiden van eerste interesse tot instroom.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {components.map((c, i) => {
            const Icon = c.icon;
            return (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="bg-card border border-border rounded-3xl p-6 flex flex-col hover:border-primary/40 hover:shadow-lg transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-primary/10 rounded-2xl p-3">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-1 rounded-full">
                    {c.badge}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2 uppercase tracking-tight">
                  {c.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">
                  {c.description}
                </p>
                {"action" in c.cta ? (
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => window.dispatchEvent(new CustomEvent("openDOORaiChat"))}
                  >
                    {c.cta.label}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full justify-between" asChild>
                    <Link to={c.cta.href}>
                      {c.cta.label}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <Button size="lg" asChild>
            <Link to="/demo">
              Volledige demo voor onderwijsregio's
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
