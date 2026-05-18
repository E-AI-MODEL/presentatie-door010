import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Briefcase, GraduationCap, MapPin, Calendar, MessageCircle, 
  BookOpen, ArrowRight, Users, Coins
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { deriveThemes } from "@/utils/themeMapper";
import type { OrientationPhase } from "@/data/dashboard-phases";
import type { KnownSlots } from "@/utils/phaseDetectorEngine";

interface RecommendedContentProps {
  currentPhase: OrientationPhase;
  knownSlots: KnownSlots;
  onOpenChat: (message?: string) => void;
}

interface ContentCard {
  icon: React.ElementType;
  label: string;
  title: string;
  description: string;
  action: { type: "chat"; message: string } | { type: "link"; href: string };
}

const THEME_TO_ICON: Record<string, React.ElementType> = {
  route: GraduationCap,
  bevoegdheid: BookOpen,
  vacatures: Briefcase,
  salaris: Coins,
  kosten: Coins,
  subsidie: Coins,
  regio: MapPin,
  toelating: BookOpen,
  functie: Users,
  sector: BookOpen,
  next_step: ArrowRight,
  events: Calendar,
  zij_instroom: GraduationCap,
};

const THEME_TO_CARD: Record<string, Omit<ContentCard, "icon">> = {
  route: {
    label: "Opleidingen",
    title: "Routes naar het leraarschap",
    description: "Bekijk welke opleidingsroutes bij jouw situatie passen.",
    action: { type: "link", href: "/opleidingen" },
  },
  vacatures: {
    label: "Werk",
    title: "Vacatures in de regio",
    description: "Bekijk actuele onderwijsvacatures in Rotterdam en omgeving.",
    action: { type: "link", href: "/vacatures" },
  },
  salaris: {
    label: "Arbeidsvoorwaarden",
    title: "Salaris en voorwaarden",
    description: "Wat verdien je als leraar en hoe zit de CAO in elkaar?",
    action: { type: "chat", message: "Wat verdient een leraar gemiddeld?" },
  },
  kosten: {
    label: "Financiering",
    title: "Kosten en financiering",
    description: "Ontdek wat een opleiding kost en welke financiering beschikbaar is.",
    action: { type: "chat", message: "Wat kost een opleiding en welke financiering is er?" },
  },
  subsidie: {
    label: "Financiering",
    title: "Subsidies en tegemoetkomingen",
    description: "Bekijk welke subsidies er zijn voor aanstaande leraren.",
    action: { type: "chat", message: "Welke subsidies zijn er voor aanstaande leraren?" },
  },
  bevoegdheid: {
    label: "Bevoegdheden",
    title: "Welke bevoegdheid past bij jou?",
    description: "Eerste- of tweedegraads, en wat betekent dat voor jou?",
    action: { type: "chat", message: "Welke bevoegdheid heb ik nodig?" },
  },
  regio: {
    label: "Regio",
    title: "Scholen in de regio",
    description: "Ontdek welke scholen en mogelijkheden er zijn bij jou in de buurt.",
    action: { type: "chat", message: "Welke scholen en mogelijkheden zijn er in mijn regio?" },
  },
  events: {
    label: "Agenda",
    title: "Events en open dagen",
    description: "Bekijk aankomende events, open dagen en banenmarkten.",
    action: { type: "link", href: "/events" },
  },
  sector: {
    label: "Sectoren",
    title: "PO, VO of MBO?",
    description: "Vergelijk de onderwijssectoren en ontdek welke bij je past.",
    action: { type: "chat", message: "Wat zijn de verschillen tussen PO, VO en MBO?" },
  },
  toelating: {
    label: "Toelating",
    title: "Toelatingseisen",
    description: "Check of jouw vooropleiding voldoet aan de eisen.",
    action: { type: "chat", message: "Wat zijn de toelatingseisen?" },
  },
  functie: {
    label: "Functies",
    title: "Functies in het onderwijs",
    description: "Ontdek welke rollen er zijn naast het leraarschap.",
    action: { type: "chat", message: "Welke functies zijn er in het onderwijs?" },
  },
  zij_instroom: {
    label: "Zij-instroom",
    title: "Zij-instroom uitgelegd",
    description: "Hoe werkt zij-instroom en is het iets voor jou?",
    action: { type: "chat", message: "Hoe werkt zij-instroom precies?" },
  },
  next_step: {
    label: "Volgende stap",
    title: "Jouw volgende stap",
    description: "Ontdek wat je nu het beste kunt doen.",
    action: { type: "chat", message: "Wat is mijn logische volgende stap?" },
  },
};

// Always-present chat card
const CHAT_CARD: ContentCard = {
  icon: MessageCircle,
  label: "DOORai",
  title: "Praat met DOORai",
  description: "Stel je vragen of bespreek je situatie in een persoonlijk gesprek.",
  action: { type: "chat", message: "" },
};

export function RecommendedContent({ currentPhase, knownSlots, onOpenChat }: RecommendedContentProps) {
  const themes = deriveThemes({
    phase: currentPhase,
    knownSlots: knownSlots as Record<string, string>,
    maxThemes: 5,
  });

  const cards: ContentCard[] = [];
  for (const theme of themes) {
    const cardData = THEME_TO_CARD[theme.key];
    if (cardData) {
      cards.push({
        icon: THEME_TO_ICON[theme.key] || BookOpen,
        ...cardData,
      });
    }
  }

  // Ensure chat card is always present
  cards.push(CHAT_CARD);

  // Cap at 6
  const visibleCards = cards.slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Aanbevolen voor jou</h2>
        <span className="text-[11px] text-muted-foreground">Op basis van je fase en profiel</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visibleCards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <CardItem card={card} onOpenChat={onOpenChat} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function CardItem({ card, onOpenChat }: { card: ContentCard; onOpenChat: (message?: string) => void }) {
  const Icon = card.icon;
  const isLink = card.action.type === "link";

  const inner = (
    <div className="group rounded-2xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-md transition-all h-full flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <div className="rounded-xl bg-primary/8 p-2 shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{card.label}</span>
          <h3 className="text-sm font-semibold text-foreground leading-tight mt-0.5">{card.title}</h3>
        </div>
      </div>
      <p className="text-[13px] text-muted-foreground leading-relaxed flex-1">{card.description}</p>
      <div className="mt-3 pt-2 border-t border-border/50">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary group-hover:gap-1.5 transition-all">
          {isLink ? "Bekijken" : card.action.type === "chat" && !("message" in card.action && card.action.message === "") ? "Vraag stellen" : "Open chat"}
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );

  if (isLink) {
    return <Link to={(card.action as { type: "link"; href: string }).href}>{inner}</Link>;
  }

  return (
    <button
      onClick={() => onOpenChat((card.action as { type: "chat"; message: string }).message || undefined)}
      className="text-left w-full"
    >
      {inner}
    </button>
  );
}
