import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const journeySteps = [
  {
    phase: 1,
    title: "Interesseren",
    description: "Ontdek wat werken in het onderwijs inhoudt en of het bij je past.",
  },
  {
    phase: 2,
    title: "Oriënteren",
    description: "Verken de verschillende sectoren, rollen en mogelijkheden.",
  },
  {
    phase: 3,
    title: "Beslissen",
    description: "Maak een weloverwogen keuze over je richting in het onderwijs.",
  },
  {
    phase: 4,
    title: "Matchen",
    description: "Vind de perfecte match tussen jouw profiel en beschikbare vacatures.",
  },
  {
    phase: 5,
    title: "Voorbereiden",
    description: "Bereid je voor op je nieuwe carrière met de juiste opleiding en begeleiding.",
  },
];

export function JourneySection() {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="container">
        <div className="flex items-center gap-3 mb-8">
          {/* Arrow icon like onderwijsloketrotterdam.nl */}
          <ArrowRight className="h-8 w-8 text-primary" />
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            <span className="text-primary">JOUW ROUTE</span> NAAR HET ONDERWIJS
          </h2>
        </div>
        
        <p className="text-muted-foreground mb-12 max-w-2xl">
          DOOR begeleidt je door elke fase — van eerste interesse tot instroom in je nieuwe baan.
        </p>

        {/* Timeline style cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {journeySteps.map((step, index) => (
            <motion.div
              key={step.phase}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="relative group"
            >
              <div className="bg-muted hover:bg-primary/5 border border-border hover:border-primary/30 rounded p-6 h-full transition-all">
                {/* Phase number */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold text-lg">
                    {step.phase}
                  </span>
                  <div className="h-px flex-1 bg-border group-hover:bg-primary/30 transition-colors" />
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold text-foreground mb-2 uppercase tracking-wide">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
