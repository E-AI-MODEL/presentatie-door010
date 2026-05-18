import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { LayoutDashboard, Users, MessageCircle, Bell, LogOut, Calendar, RefreshCw, Search, ArrowLeft, Globe } from "lucide-react";
import { UserOverviewTable, type ProfileWithEmail } from "@/components/backoffice/UserOverviewTable";
import { AdvisorChatPanel } from "@/components/backoffice/AdvisorChatPanel";
import { BackofficeStats } from "@/components/backoffice/BackofficeStats";
import { BackofficeAlerts, type DashboardAlert } from "@/components/backoffice/BackofficeAlerts";
import { CandidateDetailPanel } from "@/components/backoffice/CandidateDetailPanel";
import { AppointmentsTab } from "@/components/backoffice/AppointmentsTab";
import { TrustedSourcesTab } from "@/components/backoffice/TrustedSourcesTab";
import { SuperuserControlTab } from "@/components/backoffice/SuperuserControlTab";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

type AppRole = 'candidate' | 'advisor' | 'admin';

// Generate alerts from real profile data (punt 7: includes appointments)
function generateAlertsFromProfiles(profiles: ProfileWithEmail[]): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  for (const p of profiles) {
    const name = p.first_name && p.last_name 
      ? `${p.first_name} ${p.last_name}` 
      : p.email || 'Onbekende gebruiker';

    if (new Date(p.created_at) > weekAgo) {
      alerts.push({
        id: `signup-${p.id}`,
        type: 'new_signup',
        user_name: name,
        user_id: p.user_id,
        message: 'Nieuwe aanmelding',
        detail: p.preferred_sector ? `Interesse: ${p.preferred_sector}` : undefined,
        created_at: p.created_at,
        is_read: false,
        priority: 'low',
      });
    }

    if (p.cv_url && new Date(p.updated_at) > weekAgo) {
      alerts.push({
        id: `cv-${p.id}`,
        type: 'phase_change',
        user_name: name,
        user_id: p.user_id,
        message: 'CV geüpload',
        created_at: p.updated_at,
        is_read: false,
        priority: 'medium',
      });
    }

    if (p.test_completed && new Date(p.updated_at) > weekAgo) {
      alerts.push({
        id: `test-${p.id}`,
        type: 'needs_support',
        user_name: name,
        user_id: p.user_id,
        message: 'Interessetest voltooid',
        detail: 'Resultaten beschikbaar',
        created_at: p.updated_at,
        is_read: false,
        priority: 'medium',
      });
    }

    // Fase-wijziging alert (niet-interesseren = doorgestroomd)
    if (p.current_phase && p.current_phase !== 'interesseren' && new Date(p.updated_at) > weekAgo) {
      const phaseLabels: Record<string, string> = {
        orienteren: 'Oriënteren', beslissen: 'Beslissen', matchen: 'Matchen', voorbereiden: 'Voorbereiden',
      };
      alerts.push({
        id: `phase-${p.id}`,
        type: 'phase_change',
        user_name: name,
        user_id: p.user_id,
        message: `Doorgeschoven naar fase: ${phaseLabels[p.current_phase] || p.current_phase}`,
        created_at: p.updated_at,
        is_read: false,
        priority: 'medium',
      });
    }

    const appointments = p.appointments || [];
    for (const apt of appointments) {
      if (apt.status === 'pending') {
        alerts.push({
          id: `apt-${apt.id}`,
          type: 'needs_support',
          user_name: name,
          user_id: p.user_id,
          message: `Afspraakverzoek: ${apt.subject}`,
          detail: apt.preferred_date ? `Voorkeursdatum: ${apt.preferred_date}` : undefined,
          created_at: apt.created_at,
          is_read: false,
          priority: 'high',
        });
      }
    }
  }

  alerts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return alerts;
}

export default function Backoffice() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const [profiles, setProfiles] = useState<ProfileWithEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ProfileWithEmail | null>(null);
  const [activePanel, setActivePanel] = useState<'detail' | 'chat'>('detail');
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  // Mobile: track if chat is open in gesprekken tab
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const isSuperuser = user?.email?.toLowerCase() === "vis@emmauscollege.nl";

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      checkAccessAndFetchData();
    }
  }, [user]);

  const checkAccessAndFetchData = useCallback(async () => {
    try {
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);

      if (roleError) throw roleError;

      const access = roleData?.some(
        (r) => r.role === 'advisor' || r.role === 'admin'
      ) || isSuperuser;
      
      if (!access) {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      setHasAccess(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-profiles-with-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API fout: ${response.status}`);
      }

      const { profiles: profilesData } = await response.json();
      const realProfiles = profilesData || [];
      setProfiles(realProfiles);
      setAlerts(generateAlertsFromProfiles(realProfiles));
      
      if (selectedUser) {
        const updated = realProfiles.find((p: ProfileWithEmail) => p.user_id === selectedUser.user_id);
        if (updated) setSelectedUser(updated);
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Kon profielen niet laden. Probeer het opnieuw.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, selectedUser, isSuperuser]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    checkAccessAndFetchData();
  }, [checkAccessAndFetchData]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // Helper for selecting user + opening detail panel (with Sheet on mobile)
  const handleSelectUser = (profile: ProfileWithEmail, panel: 'detail' | 'chat' = 'detail') => {
    setSelectedUser(profile);
    setActivePanel(panel);
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

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex flex-col bg-muted/30">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Geen toegang</CardTitle>
              <CardDescription>
                Je hebt geen toegang tot de backoffice. 
                Alleen adviseurs en beheerders kunnen dit bekijken.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/dashboard")} className="w-full">
                Terug naar Dashboard
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const chatFilteredProfiles = profiles
    .filter(p => {
      if (!chatSearch) return true;
      const q = chatSearch.toLowerCase();
      return (
        p.first_name?.toLowerCase().includes(q) ||
        p.last_name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aDate = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bDate = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bDate - aDate;
    });

  // Detail/Chat panel content (reused in both inline and Sheet)
  const renderDetailOrChatPanel = () => {
    if (activePanel === 'chat') {
      return (
        <AdvisorChatPanel 
          selectedUser={selectedUser}
          onClose={() => { setSelectedUser(null); }}
        />
      );
    }
    return (
      <CandidateDetailPanel
        user={selectedUser}
        onClose={() => { setSelectedUser(null); }}
        onOpenChat={() => setActivePanel('chat')}
        onRefresh={handleRefresh}
      />
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Header />
      <main className="flex-1">
        {/* Header */}
        <section className="bg-secondary py-3 md:py-4">
          <div className="container">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-4">
                <div className="bg-primary/20 rounded-full p-2 md:p-3">
                  <LayoutDashboard className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-base md:text-xl font-bold text-secondary-foreground">
                    BackDOORai
                  </h1>
                  <p className="text-secondary-foreground/80 text-xs md:text-sm">
                    {isMobile ? `${profiles.length} kandidaten` : `Adviseur Dashboard • ${profiles.length} kandidaten`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                <Button
                  variant="outline"
                  size={isMobile ? "icon" : "sm"}
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className={isMobile ? "h-8 w-8" : ""}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''} ${isMobile ? '' : 'mr-2'}`} />
                  {!isMobile && "Vernieuwen"}
                </Button>
                <Button
                  variant="outline"
                  size={isMobile ? "icon" : "sm"}
                  onClick={handleSignOut}
                  className={isMobile ? "h-8 w-8" : ""}
                >
                  <LogOut className={`h-4 w-4 ${isMobile ? '' : 'mr-2'}`} />
                  {!isMobile && "Uitloggen"}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="container py-4 md:py-6">
          {error && (
            <div className="mb-4 md:mb-6 p-3 md:p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 text-sm">
              {error}
              <Button variant="ghost" size="sm" className="ml-4" onClick={handleRefresh}>
                Opnieuw proberen
              </Button>
            </div>
          )}

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 md:mb-6"
          >
            <BackofficeStats profiles={profiles} />
          </motion.div>

          {/* Main Content */}
          <Tabs defaultValue="overview" className="space-y-4 md:space-y-6">
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
              <TabsList className="inline-flex w-max md:w-auto md:min-w-0">
                <TabsTrigger value="overview" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                  <Users className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  {isMobile ? "Overzicht" : "Overzicht"}
                </TabsTrigger>
                <TabsTrigger value="appointments" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                  <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  {isMobile ? "Afspraken" : "Afspraken"}
                </TabsTrigger>
                <TabsTrigger value="alerts" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                  <Bell className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  {isMobile ? "Meldingen" : "Meldingen"}
                  {alerts.filter(a => a.priority === 'high').length > 0 && (
                    <Badge variant="destructive" className="ml-0.5 md:ml-1 h-4 w-4 md:h-5 md:w-5 p-0 flex items-center justify-center text-[9px] md:text-[10px]">
                      {alerts.filter(a => a.priority === 'high').length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="chat" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                  <MessageCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  {isMobile ? "Chat" : "Gesprekken"}
                </TabsTrigger>
                <TabsTrigger value="sources" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                  <Globe className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  Bronnen
                </TabsTrigger>
                {isSuperuser && (
                  <TabsTrigger value="superuser" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                    <LayoutDashboard className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    Superuser
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* === OVERVIEW TAB === */}
            <TabsContent value="overview">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {isMobile ? (
                  // Mobile: just the table (card view), detail opens as Sheet
                  <UserOverviewTable 
                    profiles={profiles} 
                    onSelectUser={(p) => handleSelectUser(p, 'detail')}
                    selectedUserId={selectedUser?.user_id}
                  />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                      <UserOverviewTable 
                        profiles={profiles} 
                        onSelectUser={(p) => handleSelectUser(p, 'detail')}
                        selectedUserId={selectedUser?.user_id}
                      />
                    </div>
                    <div className="lg:col-span-1">
                      {renderDetailOrChatPanel()}
                    </div>
                  </div>
                )}
              </motion.div>
            </TabsContent>

            {/* === APPOINTMENTS TAB === */}
            <TabsContent value="appointments">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <AppointmentsTab 
                  profiles={profiles}
                  onSelectUser={(p) => handleSelectUser(p, 'detail')}
                  onOpenChat={(p) => handleSelectUser(p, 'chat')}
                  onRefresh={handleRefresh}
                />
              </motion.div>
            </TabsContent>

            {/* === ALERTS TAB === */}
            <TabsContent value="alerts">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {isMobile ? (
                  <BackofficeAlerts 
                    alerts={alerts}
                    onSelectUser={(userId) => {
                      const profile = profiles.find(p => p.user_id === userId);
                      if (profile) handleSelectUser(profile, 'detail');
                    }}
                  />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                      <BackofficeAlerts 
                        alerts={alerts}
                        onSelectUser={(userId) => {
                          const profile = profiles.find(p => p.user_id === userId);
                          if (profile) handleSelectUser(profile, 'detail');
                        }}
                      />
                    </div>
                    <div className="lg:col-span-1">
                      <CandidateDetailPanel
                        user={selectedUser}
                        onClose={() => setSelectedUser(null)}
                        onOpenChat={() => setActivePanel('chat')}
                        onRefresh={handleRefresh}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            </TabsContent>

            {/* === SOURCES TAB === */}
            <TabsContent value="sources">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <TrustedSourcesTab />
              </motion.div>
            </TabsContent>

            {isSuperuser && (
              <TabsContent value="superuser">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <SuperuserControlTab />
                </motion.div>
              </TabsContent>
            )}

            {/* === CHAT TAB === */}
            <TabsContent value="chat">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {isMobile ? (
                  // Mobile: show list OR chat (not both)
                  mobileChatOpen && selectedUser ? (
                    <div className="space-y-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMobileChatOpen(false)}
                        className="flex items-center gap-1"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Terug naar lijst
                      </Button>
                      <AdvisorChatPanel 
                        selectedUser={selectedUser}
                        onClose={() => { setMobileChatOpen(false); setSelectedUser(null); }}
                      />
                    </div>
                  ) : (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Kandidaten</CardTitle>
                        <div className="relative mt-2">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Zoek..."
                            value={chatSearch}
                            onChange={(e) => setChatSearch(e.target.value)}
                            className="pl-8 h-8 text-xs"
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="p-2">
                        <div className="space-y-1 max-h-[500px] overflow-y-auto">
                          {chatFilteredProfiles.map((profile) => (
                            <button
                              key={profile.id}
                              onClick={() => { setSelectedUser(profile); setActivePanel('chat'); setMobileChatOpen(true); }}
                              className={`w-full text-left p-2 rounded-lg hover:bg-muted transition-colors ${
                                selectedUser?.user_id === profile.user_id ? 'bg-primary/10' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="relative">
                                  <div className="bg-primary/10 rounded-full p-1.5">
                                    <Users className="h-3 w-3 text-primary" />
                                  </div>
                                  {(profile.unread_messages ?? 0) > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center font-bold">
                                      {profile.unread_messages}
                                    </span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {profile.first_name || 'Onbekend'}
                                  </p>
                                  <div className="flex items-center gap-1">
                                    <p className="text-xs text-muted-foreground truncate">
                                      {profile.current_phase || 'Geen fase'}
                                    </p>
                                    {profile.last_message_at && (
                                      <span className="text-[10px] text-muted-foreground/60 shrink-0">
                                        • {format(new Date(profile.last_message_at), 'd MMM', { locale: nl })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )
                ) : (
                  // Desktop: side by side
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-1">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Kandidaten</CardTitle>
                          <div className="relative mt-2">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              placeholder="Zoek..."
                              value={chatSearch}
                              onChange={(e) => setChatSearch(e.target.value)}
                              className="pl-8 h-8 text-xs"
                            />
                          </div>
                        </CardHeader>
                        <CardContent className="p-2">
                          <div className="space-y-1 max-h-[500px] overflow-y-auto">
                            {chatFilteredProfiles.map((profile) => (
                              <button
                                key={profile.id}
                                onClick={() => { setSelectedUser(profile); setActivePanel('chat'); }}
                                className={`w-full text-left p-2 rounded-lg hover:bg-muted transition-colors ${
                                  selectedUser?.user_id === profile.user_id ? 'bg-primary/10' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="relative">
                                    <div className="bg-primary/10 rounded-full p-1.5">
                                      <Users className="h-3 w-3 text-primary" />
                                    </div>
                                    {(profile.unread_messages ?? 0) > 0 && (
                                      <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center font-bold">
                                        {profile.unread_messages}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {profile.first_name || 'Onbekend'}
                                    </p>
                                    <div className="flex items-center gap-1">
                                      <p className="text-xs text-muted-foreground truncate">
                                        {profile.current_phase || 'Geen fase'}
                                      </p>
                                      {profile.last_message_at && (
                                        <span className="text-[10px] text-muted-foreground/60 shrink-0">
                                          • {format(new Date(profile.last_message_at), 'd MMM', { locale: nl })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="lg:col-span-3">
                      <AdvisorChatPanel 
                        selectedUser={selectedUser}
                        onClose={() => setSelectedUser(null)}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Mobile Sheet for Detail/Chat panels */}
      {isMobile && (
        <Sheet open={!!selectedUser && !mobileChatOpen} onOpenChange={(open) => { if (!open) setSelectedUser(null); }}>
          <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-xl">
            <SheetHeader className="sr-only">
              <SheetTitle>Kandidaat details</SheetTitle>
            </SheetHeader>
            <div className="h-full overflow-auto">
              {renderDetailOrChatPanel()}
            </div>
          </SheetContent>
        </Sheet>
      )}

      <Footer />
    </div>
  );
}
