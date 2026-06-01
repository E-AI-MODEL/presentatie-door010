import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ProfileCompleteness } from "./ProfileCompleteness";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import heroBanner from "@/assets/profile-hero-banner.jpg";

interface ProfileHeroProps {
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  currentPhase: string | null;
  preferredSector: string | null;
  phone: string | null;
  bio: string | null;
  testCompleted: boolean;
  cvUrl: string | null;
}

// Frontend-vriendelijke omschrijvingen — geen interne fasenamen tonen.
const phaseLabels: Record<string, string> = {
  interesseren: "Aan het ontdekken",
  orienteren: "Aan het verkennen",
  beslissen: "Aan het kiezen",
  matchen: "Op zoek naar een plek",
  voorbereiden: "Bijna onderweg",
};

const sectorLabels: Record<string, string> = {
  po: "PO",
  vo: "VO",
  mbo: "MBO",
  so: "SO",
  onbekend: "Onbekend",
};

export function ProfileHero(props: ProfileHeroProps) {
  const navigate = useNavigate();
  const initials = `${(props.firstName || "?")[0]}${(props.lastName || "")[0] || ""}`.toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-3xl border shadow-door overflow-hidden bg-card"
    >
      {/* Decorative banner */}
      <div className="relative h-20 sm:h-28 w-full overflow-hidden bg-gradient-to-br from-primary/15 via-card to-accent/10">
        <img
          src={heroBanner}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-card/20 via-card/40 to-card" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard")}
          className="absolute top-3 left-3 h-8 w-8 bg-card/90 backdrop-blur-sm hover:bg-card text-foreground shadow-sm"
          aria-label="Terug naar dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>


      {/* Avatar overlapping banner */}
      <div className="px-5 pb-5 -mt-10 relative">
        <div className="flex items-end gap-4">
          <Avatar className="h-20 w-20 border-4 border-card shadow-door shrink-0">
            {props.avatarUrl && <AvatarImage src={props.avatarUrl} alt="Avatar" />}
            <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 pb-1">
            <h1 className="text-xl font-bold text-foreground truncate">
              {props.firstName || "Nieuw"} {props.lastName || "Profiel"}
            </h1>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {props.currentPhase && phaseLabels[props.currentPhase] && (
                <Badge className="bg-primary/15 text-primary border-0 text-[10px]">
                  {phaseLabels[props.currentPhase]}
                </Badge>
              )}
              {props.preferredSector && props.preferredSector !== "onbekend" && (
                <Badge variant="outline" className="text-[10px]">
                  {sectorLabels[props.preferredSector] || props.preferredSector}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Completeness */}
        <div className="mt-5">
          <ProfileCompleteness
            firstName={props.firstName}
            phone={props.phone}
            bio={props.bio}
            preferredSector={props.preferredSector}
            testCompleted={props.testCompleted}
            cvUrl={props.cvUrl}
          />
        </div>
      </div>
    </motion.div>
  );
}
