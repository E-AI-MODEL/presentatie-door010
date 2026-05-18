import { 
  MessageCircle, 
  BookOpen, 
  Briefcase, 
  Calendar,
  GraduationCap,
  Target,
  Lightbulb,
  CheckCircle2,
} from "lucide-react";

export type OrientationPhase = 'interesseren' | 'orienteren' | 'beslissen' | 'matchen' | 'voorbereiden';

export interface PhaseAction {
  label: string;
  href: string;
  icon: React.ElementType;
  description: string;
}

export interface PhaseInfo {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  actions: PhaseAction[];
  tips: string[];
}

export const phases: OrientationPhase[] = [
  'interesseren', 
  'orienteren', 
  'beslissen', 
  'matchen', 
  'voorbereiden'
];

export const phaseData: Record<OrientationPhase, PhaseInfo> = {
  interesseren: {
    title: "Interesseren",
    subtitle: "Ontdek of het onderwijs bij je past",
    icon: Lightbulb,
    color: "bg-primary",
    actions: [
      { label: "Praat met DOORai", href: "/chat", icon: MessageCircle, description: "Stel je eerste vragen" },
      { label: "Bekijk sectoren", href: "/kennisbank", icon: BookOpen, description: "PO, VO of MBO?" },
      { label: "Open dagen", href: "/events", icon: Calendar, description: "Bezoek een school" },
    ],
    tips: [
      "Loop een dag mee op een school",
      "Praat met leraren over hun werk",
      "Bedenk welke leeftijdsgroep je aanspreekt",
    ],
  },
  orienteren: {
    title: "Oriënteren",
    subtitle: "Onderzoek de routes naar het leraarschap",
    icon: Target,
    color: "bg-door-teal",
    actions: [
      { label: "Routes bekijken", href: "/opleidingen", icon: GraduationCap, description: "Pabo, zij-instroom, PDG..." },
      { label: "Bespreek met DOORai", href: "/chat", icon: MessageCircle, description: "Welke route past bij mij?" },
      { label: "Kennisbank", href: "/kennisbank", icon: BookOpen, description: "Bevoegdheden uitgelegd" },
    ],
    tips: [
      "Vergelijk voltijd, deeltijd en zij-instroom",
      "Check of je vooropleiding voldoet",
      "Bekijk de duur en kosten per route",
    ],
  },
  beslissen: {
    title: "Beslissen",
    subtitle: "Maak je keuze voor een route",
    icon: CheckCircle2,
    color: "bg-primary",
    actions: [
      { label: "Opleidingen vergelijken", href: "/opleidingen", icon: GraduationCap, description: "Maak je keuze" },
      { label: "Subsidies bekijken", href: "/kennisbank", icon: BookOpen, description: "Financiering opties" },
      { label: "DOORai advies", href: "/chat", icon: MessageCircle, description: "Laatste twijfels bespreken" },
    ],
    tips: [
      "Vraag naar startmomenten bij opleidingen",
      "Bekijk subsidiemogelijkheden",
      "Vraag ervaringen aan huidige studenten",
    ],
  },
  matchen: {
    title: "Matchen",
    subtitle: "Vind de juiste school of opleiding",
    icon: Briefcase,
    color: "bg-accent",
    actions: [
      { label: "Vacatures bekijken", href: "/vacatures", icon: Briefcase, description: "Scholen in Rotterdam" },
      { label: "Events & banenmarkten", href: "/events", icon: Calendar, description: "Ontmoet werkgevers" },
      { label: "Sollicitatietips", href: "/kennisbank", icon: BookOpen, description: "Bereid je voor" },
    ],
    tips: [
      "Schrijf je in bij meerdere scholen",
      "Bezoek banenmarkten en open dagen",
      "Bereid een sterke motivatie voor",
    ],
  },
  voorbereiden: {
    title: "Voorbereiden",
    subtitle: "Klaar voor de start!",
    icon: GraduationCap,
    color: "bg-emerald-700",
    actions: [
      { label: "Praktische zaken", href: "/kennisbank", icon: BookOpen, description: "Wat moet je regelen?" },
      { label: "Contact onderhouden", href: "/chat", icon: MessageCircle, description: "Laatste vragen?" },
      { label: "Agenda", href: "/events", icon: Calendar, description: "Belangrijke data" },
    ],
    tips: [
      "Regel je inschrijving op tijd",
      "Vraag naar een inwerkprogramma",
      "Neem contact op met je toekomstige collega's",
    ],
  },
};

export const quickLinks = [
  { label: "Vacatures Rotterdam", href: "/vacatures", icon: Briefcase },
  { label: "Agenda & Events", href: "/events", icon: Calendar },
  { label: "Opleidingen", href: "/opleidingen", icon: GraduationCap },
  { label: "Kennisbank", href: "/kennisbank", icon: BookOpen },
];
