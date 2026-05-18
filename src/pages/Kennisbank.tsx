import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PageHero } from "@/components/shared/PageHero";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Search, ChevronDown, ChevronUp, ExternalLink, BookOpen, FileText, Briefcase } from "lucide-react";

const categories = [
  { id: "routes", name: "Routes naar leraarschap", icon: BookOpen },
  { id: "bevoegdheden", name: "Bevoegdheden", icon: FileText },
  { id: "salaris", name: "Salaris & CAO", icon: BookOpen },
  { id: "zij-instroom", name: "Zij-instroom", icon: Briefcase },
];

const articles = [
  {
    id: 1,
    title: "Hoe word ik leraar basisonderwijs?",
    category: "routes",
    excerpt: "De route naar het basisonderwijs loopt via de Pabo. Met een bevoegdheid voor het primair onderwijs mag je lesgeven als groepsleerkracht.",
    url: "https://www.onderwijsloket.com/routes/",
  },
  {
    id: 2,
    title: "Zij-instromen: alles wat je moet weten",
    category: "zij-instroom",
    excerpt: "Met een zij-instroomtraject kun je in 2 jaar een bevoegdheid halen terwijl je al voor de klas staat.",
    url: "https://www.onderwijsloket.com/routes/",
  },
  {
    id: 3,
    title: "Eerste- en tweedegraads bevoegdheid",
    category: "bevoegdheden",
    excerpt: "Een tweedegraads bevoegdheid geeft toegang tot vmbo en onderbouw. Eerstegraads is nodig voor bovenbouw havo/vwo.",
    url: "https://www.onderwijsloket.com/index.php/kennisbank/",
  },
  {
    id: 4,
    title: "PDG-traject voor het MBO",
    category: "zij-instroom",
    excerpt: "Met een pedagogisch-didactisch getuigschrift (PDG) mag je lesgeven op een mbo-instelling.",
    url: "https://www.onderwijsloket.com/routes/",
  },
  {
    id: 5,
    title: "CAO Primair Onderwijs 2024-2025",
    category: "salaris",
    excerpt: "Bekijk de actuele salarisschalen. Een startende leraar verdient circa €2.800 bruto per maand.",
    url: "https://www.poraad.nl/themas/werkgeverszaken/cao-po",
  },
  {
    id: 6,
    title: "Subsidies voor zij-instromers",
    category: "zij-instroom",
    excerpt: "Er zijn verschillende subsidies beschikbaar, waaronder de subsidieregeling zij-instroom.",
    url: "https://www.onderwijsloket.com/index.php/kennisbank/praktische-zaken/",
  },
];

const faqs = [
  {
    question: "Wat verdient een leraar in het onderwijs?",
    answer: "Een startende leraar in het PO verdient circa €2.800 bruto per maand, oplopend tot €5.500+ met ervaring.",
  },
  {
    question: "Heb ik een diploma nodig om voor de klas te staan?",
    answer: "Ja, je hebt een lesbevoegdheid nodig. Bij zij-instroom kun je starten terwijl je de bevoegdheid haalt.",
  },
  {
    question: "Wat is het verschil tussen PO, VO en MBO?",
    answer: "PO is basisonderwijs (4-12 jaar), VO is voortgezet onderwijs (vmbo/havo/vwo), MBO is beroepsonderwijs.",
  },
  {
    question: "Hoe lang duurt het om leraar te worden?",
    answer: "Reguliere opleiding: 4 jaar. Zij-instroom: 2 jaar. Universitaire eerstegraads: 1-2 jaar na wo-master.",
  },
  {
    question: "Zijn er subsidies voor zij-instromers?",
    answer: "Ja, er zijn regelingen zoals de subsidieregeling zij-instroom en het levenlanglerenkrediet.",
  },
];

export default function Kennisbank() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const filteredArticles = articles.filter((article) => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.excerpt.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || article.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <PageHero
          variant="image"
          title="KENNIS"
          titleHighlight="BANK"
          subtitle="Vind antwoorden op al je vragen over werken in het onderwijs."
        >
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Zoek in de kennisbank..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 bg-white h-14 text-base rounded-lg border-0 shadow-lg"
            />
          </div>
        </PageHero>

        {/* Categories */}
        <section className="bg-white py-6 border-b border-border sticky top-16 z-40">
          <div className="container">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={!selectedCategory ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                Alle onderwerpen
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <cat.icon className="mr-2 h-4 w-4" />
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-12 md:py-16">
          <div className="container">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              {/* Articles */}
              <div className="lg:col-span-2">
                <h2 className="text-xl font-bold text-foreground mb-6 uppercase tracking-wide">
                  Artikelen <span className="text-primary">({filteredArticles.length})</span>
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredArticles.map((article, index) => (
                    <motion.a
                      key={article.id}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="group bg-white border border-border rounded-lg p-6 hover:border-primary/50 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-xs font-semibold px-2 py-1 bg-primary/10 text-primary rounded uppercase">
                          {categories.find(c => c.id === article.category)?.name}
                        </span>
                        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                        {article.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {article.excerpt}
                      </p>
                    </motion.a>
                  ))}
                </div>

                {filteredArticles.length === 0 && (
                  <p className="text-muted-foreground py-8 text-center">
                    Geen artikelen gevonden met deze zoekopdracht.
                  </p>
                )}
              </div>

              {/* FAQ */}
              <div>
                <h2 className="text-xl font-bold text-foreground mb-6 uppercase tracking-wide">
                  Veelgestelde <span className="text-primary">vragen</span>
                </h2>

                <div className="space-y-3">
                  {faqs.map((faq, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="bg-white border border-border rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => setOpenFaq(openFaq === index ? null : index)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                      >
                        <span className="font-medium text-foreground text-sm pr-4">
                          {faq.question}
                        </span>
                        {openFaq === index ? (
                          <ChevronUp className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                      </button>
                      {openFaq === index && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="px-4 pb-4"
                        >
                          <p className="text-sm text-muted-foreground">
                            {faq.answer}
                          </p>
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
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
              {[
                { title: "Onderwijsloket", url: "https://www.onderwijsloket.com", desc: "Landelijk informatiepunt" },
                { title: "Onderwijsloket Rotterdam", url: "https://www.onderwijsloketrotterdam.nl", desc: "Regionale begeleiding" },
                { title: "Rijksoverheid", url: "https://www.rijksoverheid.nl/onderwerpen/werken-in-het-onderwijs", desc: "Officiële informatie" },
                { title: "Studiekeuze123", url: "https://www.studiekeuze123.nl", desc: "Vergelijk opleidingen" },
              ].map((link, index) => (
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
      </main>
      <Footer />
    </div>
  );
}
