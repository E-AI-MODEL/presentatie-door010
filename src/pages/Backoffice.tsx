import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, SidebarHeader,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, Users, MessageCircle, Bell, LogOut, Calendar, RefreshCw,
  Search, ArrowLeft, Globe, Activity, ChevronDown, ChevronUp, Home,
} from "lucide-react";
import { UserOverviewTable, type ProfileWithEmail } from "@/components/backoffice/UserOverviewTable";
import { AdvisorChatPanel } from "@/components/backoffice/AdvisorChatPanel";
import { BackofficeAlerts, type DashboardAlert } from "@/components/backoffice/BackofficeAlerts";
import { CandidateDetailPanel } from "@/components/backoffice/CandidateDetailPanel";
import { AppointmentsTab } from "@/components/backoffice/AppointmentsTab";
import { TrustedSourcesTab } from "@/components/backoffice/TrustedSourcesTab";
import { SuperuserControlTab } from "@/components/backoffice/SuperuserControlTab";
import { DetectorDebugTab } from "@/components/backoffice/DetectorDebugTab";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

type SectionId = 'overview' | 'appointments' | 'alerts' | 'chat' | 'sources' | 'detector' | 'superuser';

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
        id: `signup-${p.id}`, type: 'new_signup', user_name: name, user_id: p.user_id,
        message: 'Nieuwe aanmelding',
        detail: p.preferred_sector ? `Interesse: ${p.preferred_sector}` : undefined,
        created_at: p.created_at, is_read: false, priority: 'low',
      });
    }
    if (p.cv_url && new Date(p.updated_at) > weekAgo) {
      alerts.push({
        id: `cv-${p.id}`, type: 'phase_change', user_name: name, user_id: p.user_id,
        message: 'CV geüpload', created_at: p.updated_at, is_read: false, priority: 'medium',
      });
    }
    if (p.test_completed && new Date(p.updated_at) > weekAgo) {
      alerts.push({
        id: `test-${p.id}`, type: 'needs_support', user_name: name, user_id: p.user_id,
        message: 'Interessetest voltooid', detail: 'Resultaten beschikbaar',
        created_at: p.updated_at, is_read: false, priority: 'medium',
      });
    }
    if (p.current_phase && p.current_phase !== 'interesseren' && new Date(p.updated_at) > weekAgo) {
      const phaseLabels: Record<string, string> = {
        orienteren: 'Oriënteren', beslissen: 'Beslissen', matchen: 'Matchen', voorbereiden: 'Voorbereiden',
      };
      alerts.push({
        id: `phase-${p.id}`, type: 'phase_change', user_name: name, user_id: p.user_id,
        message: `Doorgeschoven naar fase: ${phaseLabels[p.current_phase] || p.current_phase}`,
        created_at: p.updated_at, is_read: false, priority: 'medium',
      });
    }
    const appointments = p.appointments || [];
    for (const apt of appointments) {
      if (apt.status === 'pending') {
        alerts.push({
          id: `apt-${apt.id}`, type: 'needs_support', user_name: name, user_id: p.user_id,
          message: `Afspraakverzoek: ${apt.subject}`,
          detail: apt.preferred_date ? `Voorkeursdatum: ${apt.preferred_date}` : undefined,
          created_at: apt.created_at, is_read: false, priority: 'high',
        });
      }
    }
  }
  alerts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return alerts;
}

// ============== DENSE KPI STRIP ==============
function KpiStrip({ profiles, alerts }: { profiles: ProfileWithEmail[]; alerts: DashboardAlert[] }) {
  const total = profiles.length;
  const newWeek = profiles.filter(p => new Date(p.created_at) > new Date(Date.now() - 7 * 86400000)).length;
  const withChat = profiles.filter(p => (p.conversation_count ?? 0) > 0).length;
  const withCV = profiles.filter(p => !!p.cv_url).length;
  const byPhase = profiles.reduce((acc, p) => {
    const k = p.current_phase || 'interesseren';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const pendingApts = profiles.reduce((n, p) =>
    n + (p.appointments?.filter(a => a.status === 'pending').length || 0), 0);
  const urgent = alerts.filter(a => a.priority === 'high').length;

  const kpis: { label: string; value: number; tone?: 'accent' | 'primary' | 'urgent' }[] = [
    { label: 'Totaal', value: total, tone: 'primary' },
    { label: 'Nieuw 7d', value: newWeek },
    { label: 'Met gesprek', value: withChat, tone: 'accent' },
    { label: 'CV', value: withCV },
    { label: 'Open afspraken', value: pendingApts, tone: pendingApts > 0 ? 'urgent' : undefined },
    { label: 'Urgent', value: urgent, tone: urgent > 0 ? 'urgent' : undefined },
    { label: 'Interesseren', value: byPhase.interesseren || 0 },
    { label: 'Oriënteren', value: byPhase.orienteren || 0 },
    { label: 'Beslissen', value: byPhase.beslissen || 0 },
    { label: 'Matchen', value: byPhase.matchen || 0, tone: 'accent' },
    { label: 'Voorbereiden', value: byPhase.voorbereiden || 0, tone: 'primary' },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-11 gap-px bg-border rounded-lg overflow-hidden border border-border">
      {kpis.map(k => (
        <div key={k.label} className="bg-card px-2.5 py-2 flex flex-col gap-0.5 min-w-0">
          <span className={`text-lg font-bold leading-none tabular-nums ${
            k.tone === 'urgent' ? 'text-destructive' :
            k.tone === 'accent' ? 'text-accent' :
            k.tone === 'primary' ? 'text-primary' : 'text-foreground'
          }`}>{k.value}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{k.label}</span>
        </div>
      ))}
    </div>
  );
}

// ============== SIDEBAR NAV ==============
function BackofficeSidebar({
  section, onSection, alerts, pendingApts, isSuperuser, onSignOut, onHome,
}: {
  section: SectionId;
  onSection: (s: SectionId) => void;
  alerts: DashboardAlert[];
  pendingApts: number;
  isSuperuser: boolean;
  onSignOut: () => void;
  onHome: () => void;
}) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const urgentCount = alerts.filter(a => a.priority === 'high').length;

  const items: { id: SectionId; label: string; icon: typeof Users; badge?: number }[] = [
    { id: 'overview', label: 'Overzicht', icon: Users },
    { id: 'appointments', label: 'Afspraken', icon: Calendar, badge: pendingApts || undefined },
    { id: 'alerts', label: 'Meldingen', icon: Bell, badge: urgentCount || undefined },
    { id: 'chat', label: 'Gesprekken', icon: MessageCircle },
    { id: 'sources', label: 'Bronnen', icon: Globe },
    { id: 'detector', label: 'AI-analyse', icon: Activity },
  ];
  if (isSuperuser) items.push({ id: 'superuser', label: 'Superuser', icon: LayoutDashboard });

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="border-b border-border h-12 flex items-center justify-between px-2">
        <div className="flex items-center gap-2 w-full overflow-hidden">
          <div className="bg-primary/15 rounded-md p-1.5 shrink-0">
            <LayoutDashboard className="h-4 w-4 text-primary" />
          </div>
          {!collapsed && (
            <span className="text-sm font-bold leading-none truncate">BackDOOR</span>
          )}
        </div>
        <SidebarTrigger className="h-6 w-6 shrink-0" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={section === item.id}
                    onClick={() => onSection(item.id)}
                    tooltip={item.label}
                    className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-semibold"
                  >
                    <item.icon className="h-4 w-4" />
                    {!collapsed && <span>{item.label}</span>}
                    {!collapsed && item.badge ? (
                      <Badge variant="destructive" className="ml-auto h-4 px-1.5 text-[10px]">{item.badge}</Badge>
                    ) : null}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-border p-1.5 gap-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onHome} tooltip="Naar website">
              <Home className="h-4 w-4" />
              {!collapsed && <span>Website</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onSignOut} tooltip="Uitloggen">
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Uitloggen</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

// ============== MAIN ==============
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
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [section, setSection] = useState<SectionId>('overview');
  const [kpiOpen, setKpiOpen] = useState(true);
  const isSuperuser = user?.email?.toLowerCase() === "vis@emmauscollege.nl";

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const checkAccessAndFetchData = useCallback(async () => {
    if (!user) return;
    try {
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id);
      if (roleError) throw roleError;

      const access = roleData?.some(r => r.role === 'advisor' || r.role === 'admin') || isSuperuser;
      if (!access) { setHasAccess(false); setLoading(false); return; }
      setHasAccess(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-profiles-with-email`,
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error(`API fout: ${response.status}`);
      const { profiles: profilesData } = await response.json();
      const realProfiles = profilesData || [];
      setProfiles(realProfiles);
      setAlerts(generateAlertsFromProfiles(realProfiles));
      setSelectedUser(prev => prev ? realProfiles.find((p: ProfileWithEmail) => p.user_id === prev.user_id) || prev : null);
    } catch (err) {
      console.error("Error:", err);
      setError("Kon profielen niet laden. Probeer het opnieuw.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [user, isSuperuser]);

  useEffect(() => { if (user) checkAccessAndFetchData(); }, [user, checkAccessAndFetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true); checkAccessAndFetchData();
  }, [checkAccessAndFetchData]);

  useEffect(() => {
    if (!hasAccess) return;
    const channel = supabase.channel("backoffice-profiles")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => checkAccessAndFetchData())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, () => checkAccessAndFetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hasAccess, checkAccessAndFetchData]);

  const handleSignOut = async () => { await signOut(); navigate("/"); };
  const handleSelectUser = (profile: ProfileWithEmail, panel: 'detail' | 'chat' = 'detail') => {
    setSelectedUser(profile); setActivePanel(panel);
  };

  const pendingApts = useMemo(() =>
    profiles.reduce((n, p) => n + (p.appointments?.filter(a => a.status === 'pending').length || 0), 0),
    [profiles]
  );

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
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Geen toegang</CardTitle>
              <CardDescription>Alleen adviseurs en beheerders kunnen de backoffice bekijken.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/dashboard")} className="w-full">Terug naar Dashboard</Button>
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
      return p.first_name?.toLowerCase().includes(q) || p.last_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q);
    })
    .sort((a, b) => (new Date(b.last_message_at || 0).getTime()) - (new Date(a.last_message_at || 0).getTime()));

  const renderDetailOrChatPanel = () => activePanel === 'chat'
    ? <AdvisorChatPanel selectedUser={selectedUser} onClose={() => setSelectedUser(null)} />
    : <CandidateDetailPanel user={selectedUser} onClose={() => setSelectedUser(null)} onOpenChat={() => setActivePanel('chat')} onRefresh={handleRefresh} />;

  const renderSection = () => {
    switch (section) {
      case 'overview':
        return isMobile ? (
          <UserOverviewTable profiles={profiles} onSelectUser={(p) => handleSelectUser(p, 'detail')} selectedUserId={selectedUser?.user_id} />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 min-h-0">
            <div className="xl:col-span-2 min-w-0">
              <UserOverviewTable profiles={profiles} onSelectUser={(p) => handleSelectUser(p, 'detail')} selectedUserId={selectedUser?.user_id} />
            </div>
            <div className="xl:col-span-1 min-w-0">{renderDetailOrChatPanel()}</div>
          </div>
        );
      case 'appointments':
        return <AppointmentsTab profiles={profiles} onSelectUser={(p) => handleSelectUser(p, 'detail')} onOpenChat={(p) => handleSelectUser(p, 'chat')} onRefresh={handleRefresh} />;
      case 'alerts':
        return isMobile ? (
          <BackofficeAlerts alerts={alerts} onSelectUser={(uid) => { const p = profiles.find(x => x.user_id === uid); if (p) handleSelectUser(p, 'detail'); }} />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <div className="xl:col-span-2"><BackofficeAlerts alerts={alerts} onSelectUser={(uid) => { const p = profiles.find(x => x.user_id === uid); if (p) handleSelectUser(p, 'detail'); }} /></div>
            <div className="xl:col-span-1"><CandidateDetailPanel user={selectedUser} onClose={() => setSelectedUser(null)} onOpenChat={() => setActivePanel('chat')} onRefresh={handleRefresh} /></div>
          </div>
        );
      case 'chat':
        if (isMobile) {
          return mobileChatOpen && selectedUser ? (
            <div className="space-y-3">
              <Button variant="ghost" size="sm" onClick={() => setMobileChatOpen(false)} className="flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" /> Terug
              </Button>
              <AdvisorChatPanel selectedUser={selectedUser} onClose={() => { setMobileChatOpen(false); setSelectedUser(null); }} />
            </div>
          ) : (
            <ChatList profiles={chatFilteredProfiles} chatSearch={chatSearch} setChatSearch={setChatSearch} selectedUser={selectedUser}
              onSelect={(p) => { setSelectedUser(p); setActivePanel('chat'); setMobileChatOpen(true); }} />
          );
        }
        return (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 min-h-0">
            <div className="lg:col-span-1 min-w-0">
              <ChatList profiles={chatFilteredProfiles} chatSearch={chatSearch} setChatSearch={setChatSearch} selectedUser={selectedUser}
                onSelect={(p) => { setSelectedUser(p); setActivePanel('chat'); }} />
            </div>
            <div className="lg:col-span-3 min-w-0">
              <AdvisorChatPanel selectedUser={selectedUser} onClose={() => setSelectedUser(null)} />
            </div>
          </div>
        );
      case 'sources': return <TrustedSourcesTab />;
      case 'detector': return <DetectorDebugTab />;
      case 'superuser': return isSuperuser ? <SuperuserControlTab /> : null;
    }
  };

  const sectionTitle: Record<SectionId, string> = {
    overview: 'Overzicht', appointments: 'Afspraken', alerts: 'Meldingen',
    chat: 'Gesprekken', sources: 'Bronnen', detector: 'AI-analyse', superuser: 'Superuser',
  };

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="min-h-screen flex w-full bg-muted/20">
        <BackofficeSidebar
          section={section} onSection={setSection} alerts={alerts} pendingApts={pendingApts}
          isSuperuser={isSuperuser} onSignOut={handleSignOut} onHome={() => navigate("/")}
        />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="h-12 border-b border-border bg-card flex items-center px-2 gap-2 sticky top-0 z-20">
            <SidebarTrigger className="shrink-0" />
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="text-sm font-bold truncate">{sectionTitle[section]}</h1>
              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                {profiles.length} kandidaten
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setKpiOpen(v => !v)} className="h-7 text-xs gap-1 hidden sm:inline-flex">
                {kpiOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Overzicht
              </Button>
              <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing} className="h-7 w-7" aria-label="Verversen">
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            <div className="p-3 space-y-3">
              {error && (
                <div className="p-2.5 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 text-xs flex items-center justify-between">
                  <span>{error}</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleRefresh}>Opnieuw</Button>
                </div>
              )}
              {kpiOpen && <KpiStrip profiles={profiles} alerts={alerts} />}
              <div>{renderSection()}</div>
            </div>
          </main>
        </div>

        {isMobile && (
          <Sheet open={!!selectedUser && !mobileChatOpen && section !== 'chat'} onOpenChange={(open) => { if (!open) setSelectedUser(null); }}>
            <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-xl">
              <SheetHeader className="sr-only"><SheetTitle>Kandidaat details</SheetTitle></SheetHeader>
              <div className="h-full overflow-auto">{renderDetailOrChatPanel()}</div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </SidebarProvider>
  );
}

// ============== CHAT LIST ==============
function ChatList({ profiles, chatSearch, setChatSearch, selectedUser, onSelect }: {
  profiles: ProfileWithEmail[]; chatSearch: string; setChatSearch: (v: string) => void;
  selectedUser: ProfileWithEmail | null; onSelect: (p: ProfileWithEmail) => void;
}) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState<string>("all");

  const visible = profiles.filter(p => {
    if (unreadOnly && !(p.unread_messages && p.unread_messages > 0)) return false;
    if (phaseFilter !== "all" && p.current_phase !== phaseFilter) return false;
    return true;
  });

  const now = Date.now();
  const recent = visible.filter(p => !p.last_message_at || (now - new Date(p.last_message_at).getTime()) < 30 * 86400000);
  const older = visible.filter(p => p.last_message_at && (now - new Date(p.last_message_at).getTime()) >= 30 * 86400000);
  const [showOlder, setShowOlder] = useState(false);

  const phaseLabels: Record<string, string> = {
    interesseren: 'Inter.', orienteren: 'Orient.', beslissen: 'Besl.', matchen: 'Match.', voorbereiden: 'Voorb.',
  };

  const renderRow = (profile: ProfileWithEmail) => {
    const unread = profile.unread_messages ?? 0;
    const initials = `${profile.first_name?.charAt(0) || ''}${profile.last_name?.charAt(0) || ''}`.toUpperCase() || '?';
    return (
      <button key={profile.id} onClick={() => onSelect(profile)}
        className={`w-full text-left px-2 py-1.5 rounded-md hover:bg-muted transition-colors border-l-2 ${
          selectedUser?.user_id === profile.user_id ? 'bg-primary/10 border-primary' : unread > 0 ? 'border-accent' : 'border-transparent'
        }`}>
        <div className="flex items-start gap-2">
          <div className="relative shrink-0">
            <div className="bg-primary/15 text-primary rounded-full h-7 w-7 flex items-center justify-center text-[10px] font-bold">
              {initials}
            </div>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center font-bold">
                {unread}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 justify-between">
              <p className={`text-xs truncate ${unread > 0 ? 'font-bold' : 'font-medium'}`}>
                {profile.first_name || profile.email?.split('@')[0] || 'Onbekend'}
              </p>
              {profile.last_message_at && (
                <span className="text-[9px] text-muted-foreground shrink-0 tabular-nums">
                  {format(new Date(profile.last_message_at), 'd MMM', { locale: nl })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {profile.current_phase && (
                <span className="text-[9px] bg-muted px-1 rounded text-muted-foreground">{phaseLabels[profile.current_phase] || profile.current_phase}</span>
              )}
              <span className="text-[10px] text-muted-foreground truncate">
                {profile.conversation_count ? `${profile.conversation_count} gesprek(ken)` : 'Nog geen gesprek'}
              </span>
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <Card className="overflow-hidden flex flex-col">
      <CardHeader className="pb-1.5 p-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold">Kandidaten</CardTitle>
          <Badge variant="outline" className="h-4 text-[10px]">{visible.length}</Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input placeholder="Zoek..." value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} className="pl-7 h-7 text-xs" />
        </div>
        <div className="flex gap-1">
          <button onClick={() => setUnreadOnly(v => !v)}
            className={`px-1.5 py-0.5 rounded text-[10px] border ${unreadOnly ? 'bg-accent/15 border-accent text-accent' : 'border-border text-muted-foreground hover:bg-muted'}`}>
            Ongelezen
          </button>
          <select value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)}
            className="text-[10px] border border-border rounded px-1 py-0.5 bg-card text-muted-foreground">
            <option value="all">Alle fases</option>
            {Object.entries(phaseLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </CardHeader>
      <CardContent className="p-1.5 flex-1 overflow-hidden">
        <div className="space-y-0.5 max-h-[600px] overflow-y-auto">
          {recent.length === 0 && older.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Geen kandidaten</p>
          )}
          {recent.map(renderRow)}
          {older.length > 0 && (
            <>
              <button onClick={() => setShowOlder(v => !v)}
                className="w-full text-left text-[10px] text-muted-foreground hover:text-foreground py-1 px-2 mt-1 border-t border-border">
                {showOlder ? '▾' : '▸'} Ouder dan 30 dagen ({older.length})
              </button>
              {showOlder && older.map(renderRow)}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

