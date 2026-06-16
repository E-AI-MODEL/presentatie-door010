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
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden"
    >
      <div className="px-3 py-2.5 md:px-4 md:py-3 flex items-center gap-3">
        <Avatar className="h-9 w-9 md:h-10 md:w-10 border border-primary/15 shrink-0">
          {props.avatarUrl && <AvatarImage src={props.avatarUrl} alt="" />}
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-sm md:text-base font-bold text-foreground truncate leading-none">
            {props.firstName || "Daar ben je"}
          </span>
          <Badge className="bg-primary/10 text-primary border-0 text-[10px] font-medium h-5">
            {phaseSubtitle[props.currentPhase]}
          </Badge>
          {props.preferredSector && props.preferredSector !== "onbekend" && (
            <Badge variant="outline" className="text-[10px] font-medium h-5">
              <GraduationCap className="h-2.5 w-2.5 mr-1" />
              {sectorLabels[props.preferredSector] || props.preferredSector.toUpperCase()}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 min-w-[110px]">
          <Progress value={score} className="h-1.5 w-16 md:w-24" />
          <span className="text-xs font-bold text-primary tabular-nums">{score}%</span>
        </div>
      </div>

      <div className="px-3 md:px-4 pb-2 flex items-center gap-0.5 overflow-x-auto scrollbar-none">
        {phases.map((phase, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const data = phaseData[phase];
          return (
            <div key={phase} className="flex items-center" title={data.subtitle}>
              <div
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isCompleted
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold ${
                  isActive ? "bg-white/30" : isCompleted ? "bg-primary/30" : "bg-muted-foreground/20"
                }`}>
                  {isCompleted ? "✓" : index + 1}
                </span>
                {isActive && <span className="hidden sm:inline">{data.subtitle}</span>}
              </div>
              {index < phases.length - 1 && (
                <div className={`w-1.5 h-0.5 mx-0.5 ${isCompleted ? "bg-primary/40" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
