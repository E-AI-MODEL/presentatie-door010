import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GraduationCap } from "lucide-react";
import { phases, phaseData, type OrientationPhase } from "@/data/dashboard-phases";

interface HubHeroProps {
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  currentPhase: OrientationPhase;
  preferredSector: string | null;
  phone: string | null;
  bio: string | null;
  testCompleted: boolean;
  cvUrl: string | null;
}

// Frontend-vriendelijke fase labels (geen interne namen).
const phaseSubtitle: Record<OrientationPhase, string> = {
  interesseren: "Aan het ontdekken",
  orienteren: "Aan het verkennen",
  beslissen: "Aan het kiezen",
  matchen: "Op zoek naar een plek",
  voorbereiden: "Bijna onderweg",
};

const sectorLabels: Record<string, string> = {
  po: "Basisonderwijs",
  vo: "Voortgezet",
  mbo: "MBO",
  so: "Speciaal onderwijs",
};

export function HubHero(props: HubHeroProps) {
  const initials = `${(props.firstName || "?")[0]}${(props.lastName || "")[0] || ""}`.toUpperCase();
  const currentIndex = phases.indexOf(props.currentPhase);

  const completenessItems = [
    { label: "Naam", filled: !!props.firstName?.trim(), weight: 20 },
    { label: "Telefoon", filled: !!props.phone?.trim(), weight: 10 },
    { label: "Bio", filled: !!props.bio?.trim(), weight: 10 },
    { label: "Sector", filled: !!props.preferredSector, weight: 20 },
    { label: "Interessetest", filled: props.testCompleted, weight: 20 },
    { label: "CV", filled: !!props.cvUrl, weight: 20 },
  ];
  const score = completenessItems.reduce((a, i) => a + (i.filled ? i.weight : 0), 0);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-3xl border border-border/60 bg-card shadow-sm overflow-hidden"
    >
      {/* Top: identity */}
      <div className="p-5 md:p-6 flex items-center gap-4">
        <Avatar className="h-14 w-14 md:h-16 md:w-16 border-2 border-primary/15 shrink-0">
          {props.avatarUrl && <AvatarImage src={props.avatarUrl} alt="" />}
          <AvatarFallback className="bg-primary/10 text-primary font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Welkom terug
          </div>
          <h1 className="text-lg md:text-2xl font-bold text-foreground truncate leading-tight">
            {props.firstName || "Daar ben je"}
          </h1>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <Badge className="bg-primary/10 text-primary border-0 text-[10px] font-medium">
              {phaseSubtitle[props.currentPhase]}
            </Badge>
            {props.preferredSector && props.preferredSector !== "onbekend" && (
              <Badge variant="outline" className="text-[10px] font-medium">
                <GraduationCap className="h-2.5 w-2.5 mr-1" />
                {sectorLabels[props.preferredSector] || props.preferredSector.toUpperCase()}
              </Badge>
            )}
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-end shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Compleet
          </span>
          <span className="text-xl font-bold text-primary leading-none mt-1">{score}%</span>
        </div>
      </div>

      {/* Phase progress strip — flat, geen aparte band */}
      <div className="px-5 md:px-6 pb-3">
        <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-none">
          {phases.map((phase, index) => {
            const isActive = index === currentIndex;
            const isCompleted = index < currentIndex;
            const data = phaseData[phase];
            return (
              <div key={phase} className="flex items-center" title={data.subtitle}>
                <div
                  className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      isActive ? "bg-white/30" : isCompleted ? "bg-primary/30" : "bg-muted-foreground/20"
                    }`}
                  >
                    {isCompleted ? "✓" : index + 1}
                  </span>
                  {isActive && <span className="hidden sm:inline">{data.subtitle}</span>}
                </div>
                {index < phases.length - 1 && (
                  <div className={`w-2 sm:w-3 h-0.5 mx-0.5 ${isCompleted ? "bg-primary/40" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile completeness bar */}
      <div className="px-5 md:px-6 pb-5 sm:hidden">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Profiel compleet
          </span>
          <span className="text-xs font-bold text-primary">{score}%</span>
        </div>
        <Progress value={score} className="h-1.5" />
      </div>

      {/* Desktop completeness bar — onder hero */}
      <div className="hidden sm:block px-5 md:px-6 pb-5">
        <Progress value={score} className="h-1.5" />
      </div>
    </motion.section>
  );
}
