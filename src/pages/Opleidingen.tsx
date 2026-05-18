import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PageHero } from "@/components/shared/PageHero";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ExternalLink, Clock, GraduationCap, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const opleidingsRoutes = [
  {
    title: "Pabo (Leraar Basisonderwijs)",
    shortTitle: "Hbo-bachelor",
    duration: "4 jaar voltijd / deeltijd mogelijk",
    durationMonths: 48,
    niveau: "HBO",
    description: "De pabo leidt je op tot leraar in het primair onderwijs. Je leert kinderen van 4-12 jaar alle vakken.",
    aanbieders: ["Hogeschool Rotterdam", "Thomas More Hogeschool", "Hogeschool Inholland"],
    sector: "PO",
    url: "https://www.studiekeuze123.nl/opleidingen/leraar-basisonderwijs-pabo",
  },
  {
    title: "Tweedegraads Lerarenopleiding",
    shortTitle: "Hbo-bachelor",
    duration: "4 jaar voltijd / deeltijd mogelijk",
    durationMonths: 48,
    niveau: "HBO",
    description: "Lesgeven in vmbo, onderbouw havo/vwo en mbo. Specialiseer je in vakken zoals Nederlands, Engels of Wiskunde.",
    aanbieders: ["Hogeschool Rotterdam", "Hogeschool Inholland"],
    sector: "VO/MBO",
    url: "https://www.studiekeuze123.nl/opleidingen?q=tweedegraads+lerarenopleiding",
  },
  {
    title: "Eerstegraads Lerarenopleiding",
    shortTitle: "Wo-master",
    duration: "1-2 jaar na master",
    durationMonths: 24,
    niveau: "WO",
    description: "Universitaire opleiding tot eerstegraads docent voor alle niveaus in het voortgezet onderwijs.",
    aanbieders: ["Erasmus Universiteit Rotterdam", "Universiteit Leiden"],
    sector: "VO",
    url: "https://www.studiekeuze123.nl/opleidingen?q=eerstegraads+lerarenopleiding",
  },
  {
    title: "Zij-instroom traject PO",
    shortTitle: "Zij-instroom",
    duration: "2 jaar (leren + werken)",
    durationMonths: 24,
    niveau: "HBO",
    description: "Combineer werken voor de klas met een verkorte opleiding. Je hebt een hbo- of wo-diploma nodig.",
    aanbieders: ["Hogeschool Rotterdam", "Thomas More Hogeschool"],
    sector: "PO",
    url: "https://www.onderwijsloket.com/zij-instroom",
  },
  {
    title: "Zij-instroom traject VO/MBO",
    shortTitle: "Zij-instroom",
    duration: "2 jaar (leren + werken)",
    durationMonths: 24,
    niveau: "HBO",
    description: "Stap via zij-instroom over naar het voortgezet onderwijs of mbo met je vakinhoudelijke kennis.",
    aanbieders: ["Hogeschool Rotterdam", "Hogeschool Inholland"],
    sector: "VO/MBO",
    url: "https://www.onderwijsloket.com/zij-instroom",
  },
  {
    title: "PDG-traject (MBO)",
    shortTitle: "PDG",
    duration: "1 jaar",
    durationMonths: 12,
    niveau: "HBO",
    description: "Pedagogisch-didactisch getuigschrift voor lesgeven in het mbo met je vakinhoudelijke expertise.",
    aanbieders: ["Hogeschool Rotterdam", "Hogeschool Inholland"],
    sector: "MBO",
    url: "https://www.onderwijsloket.com/pdg-traject",
  },
  {
    title: "Academie Lichamelijke Opvoeding",
    shortTitle: "ALO",
    duration: "4 jaar voltijd",
    durationMonths: 48,
    niveau: "HBO",
    description: "Ongegradeerde bevoegdheid voor docent LO. Lesgeven in alle sectoren: PO, VO én MBO.",
    aanbieders: ["Hogeschool Rotterdam"],
    sector: "PO/VO/MBO",
    url: "https://www.studiekeuze123.nl/opleidingen?q=lichamelijke+opvoeding",
  },
  {
    title: "Hbo-master Eerstegraads",
    shortTitle: "Hbo-master",
    duration: "2 jaar deeltijd",
    durationMonths: 24,
    niveau: "HBO",
    description: "Breid je tweedegraads bevoegdheid uit naar eerstegraads voor bovenbouw havo/vwo.",
    aanbieders: ["Hogeschool Rotterdam"],
    sector: "VO",
    url: "https://www.studiekeuze123.nl/opleidingen?q=eerstegraads+leraar",
  },
];

const sectors = ["Alle", "PO", "VO", "MBO"];

const externalLinks = [
  { title: "Onderwijsloket", url: "https://www.onderwijsloket.com", desc: "Landelijke routes" },
  { title: "Onderwijsloket Rotterdam", url: "https://www.onderwijsloketrotterdam.nl", desc: "Regionale begeleiding" },
  { title: "Studiekeuze123", url: "https://www.studiekeuze123.nl", desc: "Vergelijk opleidingen" },
  { title: "Word leraar", url: "https://www.wordleraar.nl", desc: "Rijksoverheid" },
];

export default function Opleidingen() {
  const [selectedSector, setSelectedSector] = useState("Alle");

  const filteredRoutes = opleidingsRoutes.filter((route) => {
    return selectedSector === "Alle" || route.sector.includes(selectedSector);
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <PageHero
          variant="image"
          title="ROUTES"
          titleHighlight="NAAR HET ONDERWIJS"
          subtitle="Ontdek welke opleiding bij jou past. Van Pabo tot zij-instroom — er is altijd een route."
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
                  {sector === "Alle" ? "Alle sectoren" : sector}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Routes */}
        <section className="py-12 md:py-16">
          <div className="container">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRoutes.map((route, index) => (
                <motion.div
                  key={route.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="group bg-white border border-border rounded-lg overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all"
                >
                  <div className="bg-primary/5 p-4 border-b border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2 py-1 bg-primary text-primary-foreground rounded uppercase">
                        {route.sector}
                      </span>
                      <span className="text-xs font-medium px-2 py-1 bg-muted text-foreground rounded">
                        {route.niveau}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                      {route.title}
                    </h3>
                  </div>
                  
                  <div className="p-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      {route.description}
                    </p>

                    <div className="flex items-center gap-2 text-sm text-foreground mb-4">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="font-medium">{route.duration}</span>
                    </div>

                    <div className="text-sm mb-4">
                      <span className="font-medium text-foreground">Aanbieders:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {route.aanbieders.slice(0, 2).map((aanbieder, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 bg-muted rounded">
                            {aanbieder}
                          </span>
                        ))}
                        {route.aanbieders.length > 2 && (
                          <span className="text-xs px-2 py-0.5 bg-muted rounded">
                            +{route.aanbieders.length - 2}
                          </span>
                        )}
                      </div>
                    </div>

                    <a
                      href={route.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                    >
                      Meer informatie
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* External links */}
        <section className="bg-muted py-12">
          <div className="container">
            <h2 className="text-xl font-bold text-foreground mb-6 uppercase tracking-wide">
              Handige <span className="text-primary">links</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {externalLinks.map((link, index) => (
                <motion.a
                  key={link.title}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="group bg-white border border-border rounded-lg p-5 hover:border-primary/50 hover:shadow-md transition-all flex items-start justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {link.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">{link.desc}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </motion.a>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-secondary text-secondary-foreground py-16">
          <div className="container text-center">
            <GraduationCap className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4 uppercase">
              Weet je niet welke route past?
            </h2>
            <p className="text-secondary-foreground/80 mb-8 max-w-lg mx-auto">
              DOORai helpt je met persoonlijk advies over de beste route naar jouw carrière in het onderwijs.
            </p>
            <Button size="lg" className="bg-primary hover:bg-primary/90" asChild>
              <Link to="/auth">
                <ArrowRight className="mr-2 h-5 w-5" />
                Start met DOORai
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
