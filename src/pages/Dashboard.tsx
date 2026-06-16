import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveProfile } from "@/hooks/useLiveProfile";
import { PhaseProgress } from "@/components/dashboard/PhaseProgress";
import { TopicMenu } from "@/components/dashboard/TopicMenu";
import { RecommendedContent } from "@/components/dashboard/RecommendedContent";
import { phaseData, type OrientationPhase } from "@/data/dashboard-phases";
import type { KnownSlots } from "@/utils/phaseDetectorParser";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  MessageCircle,
  User as UserIcon,
  Briefcase,
  Calendar,
  ArrowRight,
  GraduationCap,
} from "lucide-react";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  current_phase: OrientationPhase;
  preferred_sector: string | null;
  test_completed: boolean | null;
  test_results: unknown;
  bio: string | null;
  phone: string | null;
  avatar_url: string | null;
  known_slots: Record<string, string> | null;
}

function parseKnownSlots(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") result[k] = v;
  }
  return result;
}

const sectorLabels: Record<string, string> = {
  po: "Basisonderwijs",
  vo: "Voortgezet",
  mbo: "MBO",
  so: "Speciaal onderwijs",
};

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { profile: rawProfile, loading } = useLiveProfile<any>(user?.id, "*");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?redirect=dashboard");
    }
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const profile: Profile | null = rawProfile
    ? { ...rawProfile, known_slots: parseKnownSlots(rawProfile.known_slots) }
    : null;

  const currentPhase = profile?.current_phase || "interesseren";
  const phaseInfo = phaseData[currentPhase];
  const knownSlots: KnownSlots = profile?.known_slots || {};
  const initials = `${(profile?.first_name || "?")[0]}${(profile?.last_name || "")[0] || ""}`.toUpperCase();

  const handleTopicMessage = (message: string) => {
    window.dispatchEvent(new CustomEvent("doorai-send-message", { detail: { message } }));
  };

  const handleOpenChat = (message?: string) => {
    window.dispatchEvent(new CustomEvent("doorai-send-message", { detail: { message: message || "" } }));
  };

  const quickActions = [
    { icon: MessageCircle, label: "Stel een vraag", onClick: () => handleOpenChat(), accent: "primary" as const },
    { icon: UserIcon, label: "Profiel", to: "/profile", accent: "muted" as const },
    { icon: Briefcase, label: "Vacatures", to: "/vacatures", accent: "muted" as const },
    { icon: Calendar, label: "Events", to: "/events", accent: "muted" as const },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Header />
      <main className="flex-1">
        {/* Compact identity hero */}
        <section className="bg-card border-b border-border">
          <div className="container py-5 md:py-7">
            <div className="flex items-center gap-3 md:gap-4">
              <Avatar className="h-14 w-14 md:h-16 md:w-16 border-2 border-primary/15 shrink-0">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                  Welkom terug
                </div>
                <h1 className="text-lg md:text-2xl font-bold text-foreground truncate leading-tight">
                  {profile?.first_name || "Daar ben je"}
                </h1>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <Badge className="bg-primary/10 text-primary border-0 text-[10px] font-medium">
                    {phaseInfo.title}
                  </Badge>
                  {profile?.preferred_sector && profile.preferred_sector !== "onbekend" && (
                    <Badge variant="outline" className="text-[10px] font-medium">
                      <GraduationCap className="h-2.5 w-2.5 mr-1" />
                      {sectorLabels[profile.preferred_sector] || profile.preferred_sector.toUpperCase()}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <PhaseProgress currentPhase={currentPhase} />

        <div className="container py-4 md:py-6 space-y-4 md:space-y-6">
          {/* Quick actions — grid */}
          <div className="grid grid-cols-4 gap-2 md:gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              const isPrimary = action.accent === "primary";
              const className = `group flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 md:p-4 transition-all hover:-translate-y-0.5 ${
                isPrimary
                  ? "bg-primary text-primary-foreground border-primary shadow-door"
                  : "bg-card border-border hover:border-primary/40 hover:shadow-sm"
              }`;
              const iconClass = `h-5 w-5 md:h-6 md:w-6 ${isPrimary ? "text-primary-foreground" : "text-primary"}`;
              const labelClass = `text-[10px] md:text-xs font-medium text-center leading-tight ${
                isPrimary ? "text-primary-foreground" : "text-foreground"
              }`;
              const content = (
                <>
                  <Icon className={iconClass} />
                  <span className={labelClass}>{action.label}</span>
                </>
              );
              return action.to ? (
                <Link key={action.label} to={action.to} className={className}>{content}</Link>
              ) : (
                <button key={action.label} onClick={action.onClick} className={className}>{content}</button>
              );
            })}
          </div>

          {/* Next-step CTA card */}
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/8 via-card to-accent/5 p-5 md:p-6 shadow-door">
            <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative">
              <div className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1">
                Jouw volgende stap
              </div>
              <h2 className="text-base md:text-lg font-bold text-foreground leading-tight">
                {phaseInfo.title}: {phaseInfo.subtitle || "Ontdek wat bij je past"}
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground mt-1.5 max-w-prose">
                Stel je vraag aan DoorAI. Hij denkt met je mee op basis van waar je nu staat.
              </p>
              <Button
                size="sm"
                onClick={() => handleOpenChat()}
                className="mt-3 rounded-full gap-1.5"
              >
                Start gesprek
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Tabbed content — mobile-friendly */}
          <Tabs defaultValue="onderwerpen" className="w-full">
            <TabsList className="grid grid-cols-2 w-full rounded-2xl bg-card border border-border p-1 h-auto">
              <TabsTrigger value="onderwerpen" className="rounded-xl text-xs sm:text-sm py-2">
                Onderwerpen
              </TabsTrigger>
              <TabsTrigger value="aanbevolen" className="rounded-xl text-xs sm:text-sm py-2">
                Aanbevolen voor jou
              </TabsTrigger>
            </TabsList>

            <TabsContent value="onderwerpen" className="mt-4">
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <TopicMenu
                  currentPhase={currentPhase}
                  knownSlots={knownSlots}
                  onSendMessage={handleTopicMessage}
                />
              </div>
            </TabsContent>

            <TabsContent value="aanbevolen" className="mt-4">
              <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
                <RecommendedContent
                  currentPhase={currentPhase}
                  knownSlots={knownSlots}
                  onOpenChat={handleOpenChat}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}
