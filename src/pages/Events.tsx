import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PageHero } from "@/components/shared/PageHero";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { 
  ExternalLink, 
  Calendar, 
  MapPin, 
  Laptop, 
  Users, 
  GraduationCap, 
  Lightbulb,
  Clock,
  ArrowRight
} from "lucide-react";

// Verified working event sources for Rotterdam region
const eventSources = [
  {
    title: "Onderwijsloket Rotterdam",
    description: "Officiële activiteiten en events voor zij-instromers",
    url: "https://www.onderwijsloketrotterdam.nl/activiteiten",
    category: "Primair",
    verified: true,
  },
  {
    title: "Onderwijs010",
    description: "Rotterdamse open dagen, meeloopdagen en webinars",
    url: "https://www.onderwijs010.nl/activiteiten",
    category: "Primair",
    verified: true,
  },
  {
    title: "Hogeschool Rotterdam - Lerarenopleiding",
    description: "Open dagen en voorlichtingen lerarenopleiding",
    url: "https://www.hogeschoolrotterdam.nl/opleidingen/voorlichting/",
    category: "Opleiding",
    verified: true,
  },
  {
    title: "Albeda College",
    description: "MBO docent worden - voorlichtingen",
    url: "https://www.albeda.nl/werken-bij",
    category: "MBO",
    verified: true,
  },
  {
    title: "Zadkine",
    description: "Werken in het MBO Rotterdam",
    url: "https://www.zadkine.nl/werken-bij-zadkine",
    category: "MBO",
    verified: true,
  },
  {
    title: "Landelijk Onderwijsloket",
    description: "Landelijke activiteiten en webinars",
    url: "https://www.onderwijsloket.com/activiteiten",
    category: "Landelijk",
    verified: true,
  },
];

// Example upcoming events (static for reliability)
const upcomingEvents = [
  {
    title: "Online voorlichting zij-instroom PO",
    date: "Maandelijks",
    time: "19:00 - 20:30",
    type: "Webinar",
    location: "Online",
    source: "Onderwijsloket Rotterdam",
    url: "https://www.onderwijsloketrotterdam.nl/activiteiten",
  },
  {
    title: "Meeloopdag basisschool",
    date: "Op aanvraag",
    time: "Hele dag",
    type: "Meelopen",
    location: "Rotterdam",
    source: "Onderwijs010",
    url: "https://www.onderwijs010.nl/activiteiten",
  },
  {
    title: "Open dag Hogeschool Rotterdam",
    date: "Zie website",
    time: "10:00 - 15:00",
    type: "Open dag",
    location: "Rotterdam",
    source: "Hogeschool Rotterdam",
    url: "https://www.hogeschoolrotterdam.nl/opleidingen/voorlichting/",
  },
  {
    title: "Informatiebijeenkomst leraar worden",
    date: "Regelmatig",
    time: "Avond",
    type: "Informatie",
    location: "Rotterdam",
    source: "Onderwijsloket Rotterdam",
    url: "https://www.onderwijsloketrotterdam.nl/activiteiten",
  },
];

const eventTypes = [
  { 
    id: "open-dagen", 
    title: "Open dagen", 
    description: "Bezoek hogescholen en lerarenopleidingen", 
    icon: GraduationCap,
    color: "bg-primary/10 text-primary"
  },
  { 
    id: "webinars", 
    title: "Webinars", 
    description: "Online sessies over routes en subsidies", 
    icon: Laptop,
    color: "bg-blue-100 text-blue-600"
  },
  { 
    id: "meeloopdagen", 
    title: "Meeloopdagen", 
    description: "Ervaar het vak in de praktijk", 
    icon: Users,
    color: "bg-accent/10 text-accent"
  },
  { 
    id: "info", 
    title: "Voorlichtingen", 
    description: "Ontmoet scholen en besturen", 
    icon: Lightbulb,
    color: "bg-amber-100 text-amber-600"
  },
];

export default function Events() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <PageHero
          variant="image"
          title="AGENDA"
          titleHighlight="& EVENTS"
          subtitle="Open dagen, webinars en meeloopdagen in de regio Rotterdam."
        />

        {/* Quick event type filter */}
        <section className="py-8 border-b border-border">
          <div className="container">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {eventTypes.map((type, index) => (
                <motion.div
                  key={type.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-white shrink-0`}
                >
                  <div className={`rounded-full p-1.5 ${type.color}`}>
                    <type.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{type.title}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Upcoming events - clean card layout */}
        <section className="py-10 md:py-12">
          <div className="container">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">
                Komende <span className="text-primary">events</span>
              </h2>
              <Badge variant="outline" className="text-xs">
                Klik voor actuele data
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingEvents.map((event, index) => (
                <motion.a
                  key={index}
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group"
                >
                  <Card className="h-full hover:border-primary/50 hover:shadow-md transition-all">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" className="text-xs">
                              {event.type}
                            </Badge>
                          </div>
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                            {event.title}
                          </h3>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-primary shrink-0" />
                              {event.date} • {event.time}
                            </p>
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                              {event.location}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0">
                          <div className="bg-primary/10 rounded-full p-2 group-hover:bg-primary/20 transition-colors">
                            <ArrowRight className="h-4 w-4 text-primary" />
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                        Via {event.source}
                      </p>
                    </CardContent>
                  </Card>
                </motion.a>
              ))}
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Bekijk de officiële agenda's voor actuele data en tijden
              </p>
            </div>
          </div>
        </section>

        {/* Official event sources - prominent cards */}
        <section className="py-10 md:py-12 bg-muted/30">
          <div className="container">
            <h2 className="text-lg font-bold text-foreground mb-6 uppercase tracking-wide">
              Officiële <span className="text-primary">agenda's</span>
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {eventSources.map((source, index) => (
                <motion.a
                  key={index}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group"
                >
                  <Card className="h-full hover:border-primary/50 hover:shadow-md transition-all">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="bg-primary/10 rounded-xl p-3 shrink-0">
                          <Calendar className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                              {source.title}
                            </h3>
                            {source.verified && (
                              <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                                ✓
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {source.description}
                          </p>
                          <Badge variant="secondary" className="text-xs">
                            {source.category}
                          </Badge>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.a>
              ))}
            </div>
          </div>
        </section>

        {/* CTA section */}
        <section className="py-10 md:py-12">
          <div className="container">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6 md:p-8 text-center">
                <h3 className="text-lg font-bold text-foreground mb-2">
                  Wil je persoonlijk advies over welk event bij jou past?
                </h3>
                <p className="text-muted-foreground mb-4">
                  Maak een account en DOORai helpt je de juiste keuze te maken.
                </p>
                <Button asChild>
                  <a href="/auth">
                    Account aanmaken
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
