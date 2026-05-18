import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ProfileCompleteness } from "./ProfileCompleteness";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

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

const phaseLabels: Record<string, string> = {
  interesseren: "Interesseren",
  orienteren: "Oriënteren",
  beslissen: "Beslissen",
  matchen: "Matchen",
  voorbereiden: "Voorbereiden",
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
      className="rounded-3xl bg-gradient-to-br from-primary/5 via-card to-accent/5 border shadow-door p-5"
    >
      <div className="flex items-start gap-4">
        {/* Back button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard")}
          className="text-muted-foreground shrink-0 h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {/* Avatar */}
        <Avatar className="h-14 w-14 border-2 border-primary/20 shrink-0">
          {props.avatarUrl && <AvatarImage src={props.avatarUrl} alt="Avatar" />}
          <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground truncate">
            {props.firstName || "Nieuw"} {props.lastName || "Profiel"}
          </h1>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {props.currentPhase && (
              <Badge className="bg-primary/15 text-primary border-0 text-[10px]">
                {phaseLabels[props.currentPhase] || props.currentPhase}
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

      {/* Completeness - compact */}
      <div className="mt-4">
        <ProfileCompleteness
          firstName={props.firstName}
          phone={props.phone}
          bio={props.bio}
          preferredSector={props.preferredSector}
          testCompleted={props.testCompleted}
          cvUrl={props.cvUrl}
        />
      </div>
    </motion.div>
  );
}
