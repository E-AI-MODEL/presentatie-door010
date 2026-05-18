import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, Lock, MessageCircle, ChevronDown, ExternalLink, Lightbulb, BookOpen, Briefcase, GraduationCap, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { phases, phaseData, type OrientationPhase } from "@/data/dashboard-phases";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

interface ProfileTimelineProps {
  userId: string;
  currentPhase: OrientationPhase | null;
  preferredSector: string | null;
  testCompleted: boolean;
}

const sectorLabels: Record<string, string> = {
  po: "PO - Primair Onderwijs",
  vo: "VO - Voortgezet Onderwijs",
  mbo: "MBO",
  so: "SO - Speciaal Onderwijs",
  onbekend: "Nog onbekend",
};

/** Rich descriptions per phase, drawn from SSOT data (phase-detector-rules.json + route content) */
const phaseContent: Record<OrientationPhase, {
  description: string;
  keyInfo: string[];
  links: { label: string; href: string; icon: React.ElementType }[];
}> = {
  interesseren: {
    description:
      "De interesse voor een functie in het onderwijs is gewekt. Je maakt kennis met het onderwijs als potentiële arbeidsmarkt en ontdekt of het bij je past. In deze fase verken je wat het onderwijs te bieden heeft zonder verplichtingen.",
    keyInfo: [
      "Er zijn functies als leraar, onderwijsassistent, schoolleider, instructeur en meer",
      "Sectoren: Primair Onderwijs (PO), Voortgezet Onderwijs (VO), MBO en Speciaal Onderwijs (SO)",
      "Loop een dag mee op een school om te ervaren hoe het écht is",
      "Praat met leraren en onderwijsprofessionals over hun dagelijkse werk",
      "Bedenk welke leeftijdsgroep en welk type leerling je aanspreekt",
    ],
    links: [
      { label: "Praat met DOORai", href: "/chat", icon: MessageCircle },
      { label: "Bekijk sectoren", href: "/kennisbank", icon: BookOpen },
      { label: "Open dagen & events", href: "/events", icon: Calendar },
    ],
  },
  orienteren: {
    description:
      "Je overweegt of een functie in het onderwijs passend is en onderzoekt hoe de route daarnaartoe eruitziet. Dit is het moment om verschillende opleidingsroutes te vergelijken: Pabo, zij-instroom, PDG, kopopleiding of universitaire lerarenopleiding.",
    keyInfo: [
      "Vergelijk voltijd, deeltijd en zij-instroom trajecten",
      "Met een tweedegraads bevoegdheid mag je lesgeven in vmbo, onderbouw havo/vwo en mbo",
      "Met een eerstegraads bevoegdheid mag je lesgeven in het gehele vo en mbo",
      "Een PDG (Pedagogisch Didactisch Getuigschrift) is specifiek voor het MBO",
      "Check of je vooropleiding voldoet aan de toelatingseisen",
      "Bekijk de duur (1-4 jaar) en kosten per opleidingsroute",
    ],
    links: [
      { label: "Routes bekijken", href: "/opleidingen", icon: GraduationCap },
      { label: "Bespreek met DOORai", href: "/chat", icon: MessageCircle },
      { label: "Kennisbank", href: "/kennisbank", icon: BookOpen },
    ],
  },
  beslissen: {
    description:
      "Aan het eind van de oriëntatie volgt het beslismoment: je maakt een weloverwogen keuze over je richting. Je weet welke sector je wilt, welke bevoegdheid je nodig hebt en via welke route je dit gaat bereiken.",
    keyInfo: [
      "Vraag naar startmomenten bij opleidingen (meestal september of februari)",
      "Bekijk subsidiemogelijkheden zoals de Lerarenbeurs of tegemoetkoming studiekosten",
      "Vraag ervaringen aan huidige studenten of zij-instromers",
      "Informeer bij scholen naar leer-werkplekken of stagemogelijkheden",
      "Bereken wat de opleiding financieel betekent (collegegeld, reiskosten, inkomensverlies)",
    ],
    links: [
      { label: "Opleidingen vergelijken", href: "/opleidingen", icon: GraduationCap },
      { label: "Subsidie-info", href: "/kennisbank", icon: BookOpen },
      { label: "DOORai advies", href: "/chat", icon: MessageCircle },
    ],
  },
  matchen: {
    description:
      "Wanneer je route bekend is, moet er een geschikte werk- en/of opleidingsplek worden gevonden. Je zoekt actief naar scholen in de regio Rotterdam die passen bij jouw profiel, en je bereidt je voor op het sollicitatieproces.",
    keyInfo: [
      "Schrijf je in bij meerdere scholen in de regio Rotterdam",
      "Bezoek banenmarkten en open dagen om werkgevers persoonlijk te ontmoeten",
      "Bereid een sterke motivatiebrief en CV voor",
      "Denk na over je voorkeur: grote of kleine school, stedelijk of landelijk",
      "Vraag naar begeleiding en inwerkprogramma's bij potentiële werkgevers",
    ],
    links: [
      { label: "Vacatures bekijken", href: "/vacatures", icon: Briefcase },
      { label: "Events & banenmarkten", href: "/events", icon: Calendar },
      { label: "Sollicitatietips", href: "/kennisbank", icon: BookOpen },
    ],
  },
  voorbereiden: {
    description:
      "Vóórdat je aan je eerste werk- of opleidingsdag begint, is er van alles te ondernemen. Je regelt praktische zaken, neemt contact op met je toekomstige school of opleiding en bereidt je mentaal voor op de start.",
    keyInfo: [
      "Regel je inschrijving bij de opleiding op tijd",
      "Vraag naar een inwerkprogramma bij je nieuwe school",
      "Neem contact op met je toekomstige collega's en mentor",
      "Bereid je voor op de eerste lesdag (materialen, planning)",
      "Informeer naar registratie in het lerarenregister",
    ],
    links: [
      { label: "Praktische zaken", href: "/kennisbank", icon: BookOpen },
      { label: "Laatste vragen aan DOORai", href: "/chat", icon: MessageCircle },
      { label: "Belangrijke data", href: "/events", icon: Calendar },
    ],
  },
};

export function ProfileTimeline({ userId, currentPhase, preferredSector, testCompleted }: ProfileTimelineProps) {
  const [conversationCount, setConversationCount] = useState(0);
  const [expandedPhase, setExpandedPhase] = useState<OrientationPhase | null>(null);

  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      setConversationCount(count || 0);
    };
    fetchCount();
  }, [userId]);

  const currentIndex = currentPhase ? phases.indexOf(currentPhase) : 0;

  const getStatus = (index: number) => {
    if (index < currentIndex) return "completed";
    if (index === currentIndex) return "active";
    return "locked";
  };

  const togglePhase = (phase: OrientationPhase) => {
    setExpandedPhase(prev => prev === phase ? null : phase);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-3xl border bg-card shadow-door p-5"
    >
      <h2 className="text-xs font-semibold tracking-wide uppercase text-muted-foreground mb-4">
        Jouw oriëntatietraject
      </h2>

      <div className="space-y-0.5">
        {phases.map((phase, index) => {
          const status = getStatus(index);
          const data = phaseData[phase];
          const content = phaseContent[phase];
          const isExpanded = expandedPhase === phase;

          return (
            <div key={phase} className="relative">
              {/* Clickable phase header */}
              <button
                onClick={() => togglePhase(phase)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group ${
                  isExpanded
                    ? "bg-primary/5 border border-primary/20"
                    : "hover:bg-muted/50"
                } ${status === "locked" ? "opacity-50" : ""}`}
              >
                {/* Status dot */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
                    status === "completed"
                      ? "bg-primary text-primary-foreground"
                      : status === "active"
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/20"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {status === "completed" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : status === "active" ? (
                    <Circle className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <Lock className="h-3 w-3" />
                  )}
                </div>

                {/* Title + badge */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold text-sm ${status === "active" ? "text-primary" : "text-foreground"}`}>
                      {data.title}
                    </span>
                    {status === "active" && (
                      <Badge className="bg-primary/15 text-primary border-0 text-[10px] py-0">
                        Huidige fase
                      </Badge>
                    )}
                    {status === "completed" && (
                      <span className="text-[10px] text-primary font-medium">✓</span>
                    )}
                  </div>
                </div>

                {/* Chevron */}
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Expandable content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 pt-2 ml-10 space-y-3">
                      {/* Description */}
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {content.description}
                      </p>

                      {/* Dynamic stats for active phase */}
                      {status === "active" && (
                        <div className="flex flex-wrap gap-2">
                          <div className="flex items-center gap-1.5 text-[11px] bg-primary/10 text-primary rounded-full px-2.5 py-1">
                            <MessageCircle className="h-3 w-3" />
                            {conversationCount} gesprek{conversationCount !== 1 ? "ken" : ""}
                          </div>
                          {preferredSector && (
                            <div className="text-[11px] bg-muted rounded-full px-2.5 py-1">
                              Sector: {sectorLabels[preferredSector] || preferredSector}
                            </div>
                          )}
                          {testCompleted && (
                            <div className="text-[11px] bg-primary/10 text-primary rounded-full px-2.5 py-1">
                              ✓ Test voltooid
                            </div>
                          )}
                        </div>
                      )}

                      {/* Key info bullets */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <Lightbulb className="h-3 w-3" /> Belangrijke info
                        </span>
                        <ul className="space-y-1">
                          {content.keyInfo.map((info, i) => (
                            <li key={i} className="text-[11px] text-foreground/80 leading-snug flex gap-1.5">
                              <span className="text-primary mt-0.5 shrink-0">•</span>
                              {info}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Quick links */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {content.links.map((link, i) => (
                          <Link
                            key={i}
                            to={link.href}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-lg px-2.5 py-1.5 transition-colors"
                          >
                            <link.icon className="h-3 w-3" />
                            {link.label}
                            <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
