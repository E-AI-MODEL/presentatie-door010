import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  User, 
  MapPin, 
  ExternalLink 
} from "lucide-react";
import type { OrientationPhase } from "@/data/dashboard-phases";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  current_phase: OrientationPhase;
  preferred_sector: string | null;
}

interface WelcomeHeaderProps {
  profile: Profile | null;
  onSignOut: () => void;
}

export function WelcomeHeader({ profile, onSignOut }: WelcomeHeaderProps) {
  return (
    <section className="bg-primary py-6">
      <div className="container">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 rounded-full p-3">
              <User className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-primary-foreground">
                Welkom{profile?.first_name ? `, ${profile.first_name}` : ""}!
              </h1>
              <p className="text-primary-foreground/80 text-sm">
                {profile?.preferred_sector ? `Interesse: ${profile.preferred_sector}` : "Je oriëntatie naar het onderwijs"}
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={onSignOut}>
            Uitloggen
          </Button>
        </div>
      </div>
    </section>
  );
}

interface ProfileCardProps {
  profile: Profile | null;
  phaseTitle: string;
}

export function ProfileCard({ profile, phaseTitle }: ProfileCardProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 rounded-full p-2">
          <User className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {profile?.first_name
              ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ""}`
              : "Niet ingevuld"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/50 px-2.5 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Sector</p>
          <p className="text-xs font-medium text-foreground mt-0.5">
            {profile?.preferred_sector ? profile.preferred_sector.toUpperCase() : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 px-2.5 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fase</p>
          <p className="text-xs font-medium text-primary mt-0.5">{phaseTitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs rounded-lg" asChild>
          <Link to="/profile">Profiel bewerken</Link>
        </Button>
        <a
          href="https://www.onderwijsloketrotterdam.nl"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline shrink-0"
        >
          <MapPin className="h-3 w-3" />
          Loket
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
    </div>
  );
}
