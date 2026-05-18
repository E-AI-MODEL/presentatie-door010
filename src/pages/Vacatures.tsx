import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PageHero } from "@/components/shared/PageHero";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ExternalLink, Briefcase } from "lucide-react";

const externalVacatureSites = [
  {
    title: "Meesterbaan",
    description: "De grootste vacaturesite voor het onderwijs in Nederland",
    url: "https://www.meesterbaan.nl/onderwijs-vacatures",
    sector: "PO/VO/MBO",
  },
  {
    title: "Werken in het onderwijs",
    description: "Officiële vacaturesite van de overheid",
    url: "https://www.werkeninhetonderwijs.nl/",
    sector: "PO/VO/MBO",
  },
  {
    title: "Onderwijs010",
    description: "Vacatures in de regio Rotterdam",
    url: "https://www.onderwijs010.nl/vacatures",
    sector: "PO/VO",
  },
  {
    title: "Onderwijsloket Rotterdam",
    description: "Regionale vacatures en begeleiding",
    url: "https://www.onderwijsloketrotterdam.nl/vacatures",
    sector: "PO/VO/MBO",
  },
  {
    title: "Albeda College",
    description: "Vacatures bij het grootste mbo van Rotterdam",
    url: "https://www.werkenvooralbeda.nl/",
    sector: "MBO",
  },
  {
    title: "Zadkine",
    description: "Vacatures bij ROC Zadkine Rotterdam",
    url: "https://www.werkenbijzadkine.nl/",
    sector: "MBO",
  },
  {
    title: "Solliciteer Direct",
    description: "Onderwijsvacatures in heel Nederland",
    url: "https://www.solliciteerdirect.nl/vacatures/onderwijs",
    sector: "PO/VO/MBO",
  },
];

const sectors = ["Alle sectoren", "PO", "VO", "MBO"];

export default function Vacatures() {
  const [selectedSector, setSelectedSector] = useState("Alle sectoren");

  const filteredSites = externalVacatureSites.filter((site) => {
    return selectedSector === "Alle sectoren" || site.sector.includes(selectedSector);
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <PageHero
          variant="image"
          title="VACATURES"
          titleHighlight="ROTTERDAM"
          subtitle="Bekijk de actuele vacatures bij scholen en besturen in de regio Rotterdam."
        />

        {/* Filters */}
        <section className="bg-white py-6 border-b border-border sticky top-16 z-40">
          <div className="container">
            <div className="flex flex-wrap gap-2">
              {sectors.map((sector) => (
                <Button
                  key={sector}
                  variant={selectedSector === sector ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedSector(sector)}
                >
                  {sector}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Vacancy sites */}
        <section className="py-12 md:py-16">
          <div className="container">
            <p className="text-muted-foreground mb-8">
              <span className="font-semibold text-foreground">{filteredSites.length}</span> vacaturesites gevonden
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSites.map((site, index) => (
                <motion.a
                  key={site.title}
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="group bg-white border border-border rounded-lg p-6 hover:border-primary/50 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-primary/10 rounded-full p-3">
                      <Briefcase className="h-6 w-6 text-primary" />
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 bg-primary/10 text-primary rounded uppercase">
                      {site.sector}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                    {site.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {site.description}
                  </p>
                  <div className="flex items-center text-sm text-primary font-medium">
                    Bekijk vacatures
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </div>
                </motion.a>
              ))}
            </div>
          </div>
        </section>

        {/* Tips section */}
        <section className="bg-muted py-12 md:py-16">
          <div className="container">
            <h2 className="text-xl font-bold text-foreground mb-8 uppercase tracking-wide">
              Tips voor <span className="text-primary">solliciteren</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  title: "Ken je route",
                  description: "Weet welke bevoegdheid je nodig hebt voor de vacature waar je op solliciteert.",
                },
                {
                  title: "Bereid je voor",
                  description: "Lees je in over de school en het onderwijs. Scholen waarderen betrokkenheid.",
                },
                {
                  title: "Loop mee",
                  description: "Vraag of je een dag kunt meelopen. Zo ontdek je of de school bij je past.",
                },
              ].map((tip, index) => (
                <motion.div
                  key={tip.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="bg-white rounded-lg p-6 border border-border"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                      {index + 1}
                    </span>
                    <h3 className="font-semibold text-foreground">{tip.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{tip.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
