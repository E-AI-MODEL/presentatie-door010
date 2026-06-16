import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveProfile, notifyProfileUpdated } from "@/hooks/useLiveProfile";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TopicMenu } from "@/components/dashboard/TopicMenu";
import { RecommendedContent } from "@/components/dashboard/RecommendedContent";
import { HubHero } from "@/components/dashboard/HubHero";
import { phaseData, type OrientationPhase } from "@/data/dashboard-phases";
import type { KnownSlots } from "@/utils/phaseDetectorParser";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { CVUpload } from "@/components/profile/CVUpload";
import { InterestTest } from "@/components/profile/InterestTest";
import { NotesTile } from "@/components/profile/NotesTile";
import { SavedVacanciesTile } from "@/components/profile/SavedVacanciesTile";
import { SavedEventsTile } from "@/components/profile/SavedEventsTile";
import { AppointmentTile } from "@/components/profile/AppointmentTile";
import { ProfileTimeline } from "@/components/profile/ProfileTimeline";
import {
  MessageCircle,
  Briefcase,
  Calendar,
  User,
  Mail,
  Phone,
  GraduationCap,
  Target,
  CheckCircle2,
  Save,
  FileText,
} from "lucide-react";

const TAB_VALUES = ["vandaag", "profiel", "documenten", "activiteit"] as const;
type TabValue = (typeof TAB_VALUES)[number];

const phases: { value: OrientationPhase; label: string; description: string }[] = [
  { value: "interesseren", label: "Aan het ontdekken", description: "Eerste verkenning" },
  { value: "orienteren", label: "Aan het verkennen", description: "Routes onderzoeken" },
  { value: "beslissen", label: "Aan het kiezen", description: "Knoop doorhakken" },
  { value: "matchen", label: "Op zoek naar een plek", description: "Match met school" },
  { value: "voorbereiden", label: "Bijna onderweg", description: "Klaar voor de start" },
];

const sectors = [
  { value: "po", label: "PO", description: "Basisschool" },
  { value: "vo", label: "VO", description: "Middelbaar" },
  { value: "mbo", label: "MBO", description: "Beroepsonderwijs" },
  { value: "so", label: "SO", description: "Speciaal onderwijs" },
  { value: "onbekend", label: "Nog onbekend", description: "Nog ontdekken" },
];

function parseKnownSlots(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") result[k] = v;
  }
  return result;
}

// Consistente tile-wrapper.
function TileCard({
  icon: Icon,
  title,
  description,
  children,
  className = "",
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`rounded-2xl border-border/60 shadow-sm hover:shadow-md transition-shadow h-full ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="h-3.5 w-3.5" />
          </span>
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="text-xs">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile: rawProfile, loading } = useLiveProfile<any>(user?.id, "*");

  // Editable state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [currentPhase, setCurrentPhase] = useState<OrientationPhase>("interesseren");
  const [preferredSector, setPreferredSector] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [testCompleted, setTestCompleted] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const hydratedRef = useRef(false);

  // Hydrate from live profile (once + when raw changes externally and not dirty)
  useEffect(() => {
    if (!rawProfile) return;
    if (hydratedRef.current && dirty) return;
    setFirstName(rawProfile.first_name || "");
    setLastName(rawProfile.last_name || "");
    setPhone(rawProfile.phone || "");
    setBio(rawProfile.bio || "");
    setCurrentPhase((rawProfile.current_phase as OrientationPhase) || "interesseren");
    setPreferredSector(rawProfile.preferred_sector || "");
    setAvatarUrl(rawProfile.avatar_url ?? null);
    setCvUrl(rawProfile.cv_url ?? null);
    setTestCompleted(!!rawProfile.test_completed);
    setTestResults((rawProfile.test_results as Record<string, unknown> | null) ?? null);
    hydratedRef.current = true;
  }, [rawProfile, dirty]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?redirect=dashboard");
  }, [user, authLoading, navigate]);

  // Tab state via URL ?tab=
  const urlTab = searchParams.get("tab");
  const activeTab: TabValue = (TAB_VALUES.includes(urlTab as TabValue) ? urlTab : "vandaag") as TabValue;
  const setActiveTab = (val: string) => {
    const next = new URLSearchParams(searchParams);
    if (val === "vandaag") next.delete("tab");
    else next.set("tab", val);
    setSearchParams(next, { replace: true });
  };

  const knownSlots: KnownSlots = useMemo(
    () => parseKnownSlots(rawProfile?.known_slots),
    [rawProfile?.known_slots]
  );

  const handleOpenChat = (message?: string) => {
    window.dispatchEvent(new CustomEvent("doorai-send-message", { detail: { message: message || "" } }));
  };

  const handleTopicMessage = (message: string) => {
    window.dispatchEvent(new CustomEvent("doorai-send-message", { detail: { message } }));
  };

  const markDirty = <T,>(setter: (v: T) => void) => (v: T) => {
    setDirty(true);
    setter(v);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          phone: phone.trim() || null,
          bio: bio.trim() || null,
          current_phase: currentPhase,
          preferred_sector: preferredSector || null,
        })
        .eq("user_id", user.id);
      if (error) throw error;
      notifyProfileUpdated();
      setDirty(false);
      toast({ title: "Profiel opgeslagen", description: "Je wijzigingen zijn opgeslagen." });
    } catch (err) {
      console.error(err);
      toast({
        title: "Fout bij opslaan",
        description: "Er ging iets mis. Probeer opnieuw.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

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

  const phaseInfo = phaseData[currentPhase];

  const quickActions = [
    { icon: MessageCircle, label: "Stel een vraag", onClick: () => handleOpenChat(), primary: true },
    { icon: User, label: "Mijn profiel", onClick: () => setActiveTab("profiel") },
    { icon: Briefcase, label: "Vacatures", to: "/vacatures" },
    { icon: Calendar, label: "Events", to: "/events" },
  ];

  const showSaveBar = dirty && (activeTab === "profiel" || activeTab === "documenten");

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Header />
      <main className="flex-1">
        <div className="container max-w-7xl py-3 md:py-4 space-y-3">
          <HubHero
            firstName={firstName}
            lastName={lastName}
            avatarUrl={avatarUrl}
            currentPhase={currentPhase}
            preferredSector={preferredSector}
            phone={phone}
            bio={bio}
            testCompleted={testCompleted}
            cvUrl={cvUrl}
          />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="inline-flex h-8 gap-1 rounded-full bg-muted p-0.5">
              {[
                { v: "vandaag", l: "Vandaag" },
                { v: "profiel", l: "Profiel" },
                { v: "documenten", l: "Documenten" },
                { v: "activiteit", l: "Activiteit" },
              ].map((t) => (
                <TabsTrigger
                  key={t.v}
                  value={t.v}
                  className="rounded-full px-3 py-1 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                >
                  {t.l}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* === VANDAAG === */}
            <TabsContent value="vandaag" className="mt-3">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                <aside className="lg:col-span-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {quickActions.map((a) => {
                      const Icon = a.icon;
                      const cls = `group flex items-center gap-2 rounded-xl border p-2.5 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                        a.primary
                          ? "bg-primary text-primary-foreground border-primary shadow-door"
                          : "bg-card border-border/60 hover:border-primary/40"
                      }`;
                      const chipCls = `h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                        a.primary ? "bg-white/20" : "bg-primary/10"
                      }`;
                      const iconCls = `h-3.5 w-3.5 ${a.primary ? "text-primary-foreground" : "text-primary"}`;
                      const labelCls = `text-xs font-bold leading-tight ${
                        a.primary ? "text-primary-foreground" : "text-foreground"
                      }`;
                      const inner = (
                        <>
                          <span className={chipCls}><Icon className={iconCls} /></span>
                          <span className={labelCls}>{a.label}</span>
                        </>
                      );
                      return a.to ? (
                        <Link key={a.label} to={a.to} className={cls}>{inner}</Link>
                      ) : (
                        <button key={a.label} type="button" onClick={a.onClick} className={cls}>{inner}</button>
                      );
                    })}
                  </div>

                  <div className="rounded-2xl border border-border/40 bg-card/50 overflow-hidden">
                    <div className="px-3 pt-2.5 pb-1">
                      <h3 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80">
                        PROMPT BIBLIOTHEEK
                      </h3>
                    </div>
                    <TopicMenu
                      currentPhase={currentPhase}
                      knownSlots={knownSlots}
                      onSendMessage={handleTopicMessage}
                    />
                  </div>
                </aside>

                <section className="lg:col-span-8">
                  <div className="rounded-2xl border border-border/60 bg-card p-3 md:p-4 shadow-sm">
                    <RecommendedContent
                      currentPhase={currentPhase}
                      knownSlots={knownSlots}
                      onOpenChat={handleOpenChat}
                    />
                  </div>
                </section>
              </div>
            </TabsContent>


            {/* === PROFIEL === */}
            <TabsContent value="profiel" className="mt-4">
              <form onSubmit={handleSave}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <TileCard icon={User} title="Gegevens">
                    <div className="flex justify-center pb-3 border-b border-border/60">
                      <AvatarUpload
                        userId={user.id}
                        currentAvatarUrl={avatarUrl}
                        firstName={firstName}
                        lastName={lastName}
                        onAvatarChange={(v) => { setDirty(true); setAvatarUrl(v); }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="firstName" className="text-[10px] uppercase tracking-wider text-muted-foreground">Voornaam</Label>
                        <Input id="firstName" value={firstName} onChange={(e) => markDirty(setFirstName)(e.target.value)} placeholder="Voornaam" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="lastName" className="text-[10px] uppercase tracking-wider text-muted-foreground">Achternaam</Label>
                        <Input id="lastName" value={lastName} onChange={(e) => markDirty(setLastName)(e.target.value)} placeholder="Achternaam" className="h-8 text-sm" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">E-mail</Label>
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="phone" className="text-[10px] uppercase tracking-wider text-muted-foreground">Telefoon</Label>
                      <div className="relative">
                        <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input id="phone" type="tel" value={phone} onChange={(e) => markDirty(setPhone)(e.target.value)} placeholder="06-12345678" className="pl-8 h-8 text-sm" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="bio" className="text-[10px] uppercase tracking-wider text-muted-foreground">Over jezelf</Label>
                      <Textarea id="bio" value={bio} onChange={(e) => markDirty(setBio)(e.target.value)} placeholder="Kort iets over jezelf..." rows={2} className="text-sm resize-none" />
                    </div>
                  </TileCard>

                  <TileCard icon={GraduationCap} title="Sector" description="Waar wil je werken?">
                    <div className="grid grid-cols-1 gap-1.5">
                      {sectors.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => markDirty(setPreferredSector)(s.value)}
                          className={`p-2.5 rounded-xl border text-left transition-all text-sm ${
                            preferredSector === s.value
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border/60 hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium text-foreground text-sm">{s.label}</span>
                              <span className="text-xs text-muted-foreground ml-2">{s.description}</span>
                            </div>
                            {preferredSector === s.value && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </TileCard>

                  <TileCard icon={Target} title="Waar sta je nu?" description="Jouw moment in het proces">
                    <div className="grid grid-cols-1 gap-1.5">
                      {phases.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => markDirty(setCurrentPhase)(p.value)}
                          className={`p-2.5 rounded-xl border text-left transition-all text-sm ${
                            currentPhase === p.value
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border/60 hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium text-foreground text-sm">{p.label}</span>
                              <span className="text-xs text-muted-foreground ml-2">{p.description}</span>
                            </div>
                            {currentPhase === p.value && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </TileCard>
                </div>
              </form>
            </TabsContent>

            {/* === DOCUMENTEN === */}
            <TabsContent value="documenten" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InterestTest
                  userId={user.id}
                  testCompleted={testCompleted}
                  testResults={testResults}
                  onTestComplete={(results) => {
                    setTestCompleted(true);
                    setTestResults(results);
                    if (results.recommendedSector) {
                      setDirty(true);
                      setPreferredSector(results.recommendedSector as string);
                    }
                  }}
                />
                <CVUpload userId={user.id} currentCVUrl={cvUrl} onCVChange={setCvUrl} />
                <div className="md:col-span-2">
                  <NotesTile userId={user.id} />
                </div>
              </div>
            </TabsContent>

            {/* === ACTIVITEIT === */}
            <TabsContent value="activiteit" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AppointmentTile userId={user.id} />
                <SavedVacanciesTile userId={user.id} />
                <SavedEventsTile userId={user.id} />
                <div className="md:col-span-2">
                  <ProfileTimeline
                    userId={user.id}
                    currentPhase={currentPhase}
                    preferredSector={preferredSector}
                    testCompleted={testCompleted}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Sticky save bar — alleen als dirty en in editable tab */}
          {showSaveBar && (
            <div className="sticky bottom-4 z-30 flex justify-end gap-3 bg-background/85 backdrop-blur-sm rounded-2xl border border-border/60 p-3 shadow-md">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  // Reset to last hydrated values
                  if (!rawProfile) return;
                  setFirstName(rawProfile.first_name || "");
                  setLastName(rawProfile.last_name || "");
                  setPhone(rawProfile.phone || "");
                  setBio(rawProfile.bio || "");
                  setCurrentPhase((rawProfile.current_phase as OrientationPhase) || "interesseren");
                  setPreferredSector(rawProfile.preferred_sector || "");
                  setDirty(false);
                }}
              >
                Annuleren
              </Button>
              <Button type="button" size="sm" disabled={saving} onClick={() => handleSave()}>
                {saving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-1.5" />
                    Opslaan...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Opslaan
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
