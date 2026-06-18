import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Search, Phone, MessageCircle, FileText, ClipboardCheck, User,
  ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, SlidersHorizontal, Layers, List,
  ChevronsDownUp, ChevronsUpDown,
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";

type OrientationPhase = 'interesseren' | 'orienteren' | 'beslissen' | 'matchen' | 'voorbereiden';

export interface Appointment {
  id: string;
  user_id: string;
  subject: string;
  message: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  status: string;
  advisor_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedEvent {
  id: string; user_id: string; event_title: string; event_date: string | null;
  event_url: string | null; event_source: string | null; created_at: string;
}

export interface SavedVacancy {
  id: string; user_id: string; title: string; organization: string | null;
  url: string | null; sector: string | null; notes: string | null; created_at: string;
}

export interface UserNote {
  id: string; user_id: string; title: string; content: string;
  created_at: string; updated_at: string;
}

export interface ProfileWithEmail {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  current_phase: OrientationPhase | null;
  preferred_sector: string | null;
  created_at: string;
  updated_at: string;
  last_activity?: string;
  unread_messages?: number;
  conversation_count?: number;
  last_message_at?: string | null;
  avatar_url?: string | null;
  cv_url?: string | null;
  test_completed?: boolean;
  test_results?: Record<string, unknown> | null;
  appointments?: Appointment[];
  saved_events?: SavedEvent[];
  saved_vacancies?: SavedVacancy[];
  user_notes?: UserNote[];
}

const phaseLabels: Record<OrientationPhase, { label: string; color: string }> = {
  interesseren: { label: 'Interesseren', color: 'bg-accent/15 text-accent border-accent/30' },
  orienteren: { label: 'Oriënteren', color: 'bg-primary/10 text-primary border-primary/25' },
  beslissen: { label: 'Beslissen', color: 'bg-primary/20 text-primary border-primary/40' },
  matchen: { label: 'Matchen', color: 'bg-accent/25 text-accent border-accent/40' },
  voorbereiden: { label: 'Voorbereiden', color: 'bg-primary/30 text-primary-foreground border-primary' },
};

const sectorLabels: Record<string, string> = {
  po: 'Primair Onderwijs', vo: 'Voortgezet Onderwijs', mbo: 'MBO', so: 'Speciaal Onderwijs', onbekend: 'Nog onbekend',
};

interface Props {
  profiles: ProfileWithEmail[];
  onSelectUser: (profile: ProfileWithEmail) => void;
  selectedUserId?: string;
}

type SortKey = 'name' | 'contact' | 'phase' | 'activity' | null;
type SortDir = 'asc' | 'desc';
const PHASE_ORDER: OrientationPhase[] = ['interesseren', 'orienteren', 'beslissen', 'matchen', 'voorbereiden'];

function PhasePill({ phase }: { phase: OrientationPhase | null }) {
  const p = phase || 'interesseren';
  const cfg = phaseLabels[p];
  return <Badge variant="outline" className={cn("text-[10px] font-medium px-1.5 h-4", cfg.color)}>{cfg.label}</Badge>;
}

export function UserOverviewTable({ profiles, onSelectUser, selectedUserId }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>('activity');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [groupByPhase, setGroupByPhase] = useState(true);
  // null = use default (only first non-empty group open); object = explicit user state
  const [openGroups, setOpenGroups] = useState<Record<string, boolean> | null>(null);
  const isMobile = useIsMobile();

  const toggleSort = (key: NonNullable<SortKey>) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filteredProfiles = useMemo(() => {
    const list = profiles.filter(p => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        p.first_name?.toLowerCase().includes(q) ||
        p.last_name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.phone?.includes(searchQuery);
      const matchesPhase = phaseFilter === "all" || p.current_phase === phaseFilter;
      const matchesSector = sectorFilter === "all" || p.preferred_sector === sectorFilter;
      return matchesSearch && matchesPhase && matchesSector;
    });

    if (!sortKey) return list;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let av: string | number = '', bv: string | number = '';
      switch (sortKey) {
        case 'name':
          av = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase() || (a.email || '').toLowerCase();
          bv = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase() || (b.email || '').toLowerCase();
          break;
        case 'contact':
          av = (a.email || a.phone || '').toLowerCase(); bv = (b.email || b.phone || '').toLowerCase(); break;
        case 'phase':
          av = PHASE_ORDER.indexOf((a.current_phase || 'interesseren') as OrientationPhase);
          bv = PHASE_ORDER.indexOf((b.current_phase || 'interesseren') as OrientationPhase); break;
        case 'activity':
          av = new Date(a.last_message_at || a.updated_at || a.created_at).getTime();
          bv = new Date(b.last_message_at || b.updated_at || b.created_at).getTime(); break;
      }
      if (av < bv) return -1 * dir; if (av > bv) return 1 * dir; return 0;
    });
  }, [profiles, searchQuery, phaseFilter, sectorFilter, sortKey, sortDir]);

  const groups = useMemo(() => {
    const out: Record<OrientationPhase, ProfileWithEmail[]> = {
      interesseren: [], orienteren: [], beslissen: [], matchen: [], voorbereiden: [],
    };
    for (const p of filteredProfiles) {
      const k = (p.current_phase || 'interesseren') as OrientationPhase;
      out[k].push(p);
    }
    return out;
  }, [filteredProfiles]);

  const SortIcon = ({ k }: { k: NonNullable<SortKey> }) =>
    sortKey !== k ? <ArrowUpDown className="h-3 w-3 opacity-40" /> :
      sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />;

  const activeFilters = (searchQuery ? 1 : 0) + (phaseFilter !== 'all' ? 1 : 0) + (sectorFilter !== 'all' ? 1 : 0);

  // Default-open logic: when user hasn't toggled anything, open only the
  // first non-empty phase group so the panel stays compact.
  const firstNonEmpty = PHASE_ORDER.find(p => groups[p].length > 0);
  const isGroupOpen = (phase: OrientationPhase) =>
    openGroups ? openGroups[phase] === true : phase === firstNonEmpty;
  const anyOpen = PHASE_ORDER.some(p => groups[p].length > 0 && isGroupOpen(p));
  const toggleGroup = (phase: OrientationPhase) =>
    setOpenGroups(prev => {
      const base = prev ?? PHASE_ORDER.reduce((acc, p) => {
        acc[p] = p === firstNonEmpty; return acc;
      }, {} as Record<string, boolean>);
      return { ...base, [phase]: !base[phase] };
    });
  const toggleAll = () => {
    const next = !anyOpen;
    setOpenGroups(PHASE_ORDER.reduce((acc, p) => { acc[p] = next; return acc; }, {} as Record<string, boolean>));
  };

  const renderRow = (profile: ProfileWithEmail) => {
    const initials = `${profile.first_name?.charAt(0) || ''}${profile.last_name?.charAt(0) || ''}`.toUpperCase();
    return (
      <TableRow key={profile.id}
        className={cn("hover:bg-muted/40 cursor-pointer h-8", selectedUserId === profile.user_id && "bg-primary/5")}
        onClick={() => onSelectUser(profile)}>
        <TableCell className="py-0.5">
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <Avatar className="h-6 w-6">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                  {initials || <User className="h-3 w-3" />}
                </AvatarFallback>
              </Avatar>
              {(profile.unread_messages ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-[8px] rounded-full h-3 w-3 flex items-center justify-center font-bold">
                  {profile.unread_messages}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate leading-tight">
                {profile.first_name && profile.last_name ? `${profile.first_name} ${profile.last_name}` : profile.first_name || 'Niet ingevuld'}
              </p>
              <p className="text-[10px] text-muted-foreground truncate leading-tight flex items-center gap-1">
                {profile.phone && (
                  <span className="inline-flex items-center gap-0.5 text-foreground/70">
                    <Phone className="h-2.5 w-2.5" />{profile.phone}
                  </span>
                )}
                {profile.phone && profile.email && <span className="opacity-40">·</span>}
                <span className="truncate">{profile.email || (!profile.phone ? '—' : '')}</span>
              </p>
            </div>
          </div>
        </TableCell>
        <TableCell className="py-0.5"><PhasePill phase={profile.current_phase} /></TableCell>
        <TableCell className="py-0.5">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn("inline-flex items-center", profile.cv_url ? "text-primary" : "text-muted-foreground/30")}>
                  <FileText className="h-3 w-3" />
                </span>
              </TooltipTrigger>
              <TooltipContent>{profile.cv_url ? 'CV beschikbaar' : 'Geen CV'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn("inline-flex items-center", profile.test_completed ? "text-primary" : "text-muted-foreground/30")}>
                  <ClipboardCheck className="h-3 w-3" />
                </span>
              </TooltipTrigger>
              <TooltipContent>{profile.test_completed ? 'Test voltooid' : 'Geen test'}</TooltipContent>
            </Tooltip>
          </div>
        </TableCell>
        <TableCell className="py-0.5 text-[11px] text-muted-foreground tabular-nums">
          {profile.last_message_at
            ? format(new Date(profile.last_message_at), 'd MMM', { locale: nl })
            : format(new Date(profile.created_at), 'd MMM', { locale: nl })}
        </TableCell>
        <TableCell className="py-0.5 text-right">
          <Button variant="ghost" size="icon" className="h-6 w-6"
            onClick={(e) => { e.stopPropagation(); onSelectUser(profile); }}>
            <MessageCircle className="h-3 w-3" />
          </Button>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setFiltersOpen(o => !o)}>
          <SlidersHorizontal className="h-3 w-3" />
          Filters
          {activeFilters > 0 && <Badge variant="secondary" className="h-3.5 px-1 text-[9px] ml-0.5">{activeFilters}</Badge>}
          <ChevronDown className={cn("h-3 w-3 transition-transform", filtersOpen && "rotate-180")} />
        </Button>
        <div className="flex rounded-md border border-border overflow-hidden">
          <button onClick={() => setGroupByPhase(true)}
            className={cn("px-2 py-1 text-[11px] inline-flex items-center gap-1",
              groupByPhase ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
            <Layers className="h-3 w-3" />Per fase
          </button>
          <button onClick={() => setGroupByPhase(false)}
            className={cn("px-2 py-1 text-[11px] inline-flex items-center gap-1",
              !groupByPhase ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
            <List className="h-3 w-3" />Lijst
          </button>
        </div>
        {groupByPhase && !isMobile && (
          <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2" onClick={toggleAll}
            title={anyOpen ? 'Alle fases inklappen' : 'Alle fases uitklappen'}>
            {anyOpen ? <ChevronsDownUp className="h-3 w-3" /> : <ChevronsUpDown className="h-3 w-3" />}
            {anyOpen ? 'Inklappen' : 'Uitklappen'}
          </Button>
        )}
        <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">
          {filteredProfiles.length} / {profiles.length}
        </span>
      </div>

      {/* Collapsible filters */}
      {filtersOpen && (
        <Card className="p-2">
          <div className="flex flex-col sm:flex-row gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input placeholder="Zoek naam, email, telefoon..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} className="pl-7 h-7 text-xs" />
            </div>
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className="w-full sm:w-32 h-7 text-xs"><SelectValue placeholder="Fase" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle fases</SelectItem>
                {Object.entries(phaseLabels).map(([v, { label }]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-full sm:w-36 h-7 text-xs"><SelectValue placeholder="Sector" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle sectoren</SelectItem>
                {Object.entries(sectorLabels).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Card>
      )}

      {/* Mobile cards */}
      {isMobile ? (
        <div className="space-y-1.5">
          {filteredProfiles.length === 0 ? (
            <p className="text-center py-6 text-xs text-muted-foreground">Geen kandidaten</p>
          ) : filteredProfiles.map((p) => {
            const initials = `${p.first_name?.charAt(0) || ''}${p.last_name?.charAt(0) || ''}`.toUpperCase();
            return (
              <Card key={p.id} className={cn("p-2 active:scale-[0.99] transition", selectedUserId === p.user_id && "ring-1 ring-primary")} onClick={() => onSelectUser(p)}>
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7"><AvatarFallback className="bg-primary/10 text-primary text-[10px]">{initials || <User className="h-3 w-3" />}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-medium truncate">{p.first_name || p.email || '—'}</p>
                      <PhasePill phase={p.current_phase} />
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{p.email || p.phone || '—'}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <TooltipProvider>
            {groupByPhase ? (
              <div>
                {PHASE_ORDER.map(phase => {
                  const list = groups[phase];
                  if (!list.length) return null;
                  const open = isGroupOpen(phase);
                  const groupUnread = list.reduce((sum, p) => sum + (p.unread_messages ?? 0), 0);
                  return (
                    <div key={phase} className="border-b border-border last:border-b-0">
                      <button onClick={() => toggleGroup(phase)}
                        className="w-full flex items-center gap-2 px-2.5 py-1 hover:bg-muted/50 bg-muted/20 text-left sticky top-0 z-10">
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
                        <PhasePill phase={phase} />
                        {groupUnread > 0 && (
                          <Badge className="h-4 text-[9px] px-1 bg-accent text-accent-foreground border-transparent">
                            {groupUnread} ongelezen
                          </Badge>
                        )}
                        <Badge variant="outline" className="h-4 text-[10px] ml-auto tabular-nums">{list.length}</Badge>
                      </button>
                      {open && (
                        <div className="max-h-[280px] overflow-y-auto">
                          <Table>
                            <TableBody>{list.map(renderRow)}</TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredProfiles.length === 0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground">Geen kandidaten gevonden</div>
                )}
              </div>
            ) : (
              <div className="max-h-[640px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow className="bg-muted/40 h-8">
                      <TableHead className="py-1"><button onClick={() => toggleSort('name')} className="flex items-center gap-1 text-xs font-medium hover:text-foreground">Kandidaat <SortIcon k="name" /></button></TableHead>
                      <TableHead className="py-1"><button onClick={() => toggleSort('phase')} className="flex items-center gap-1 text-xs font-medium hover:text-foreground">Fase <SortIcon k="phase" /></button></TableHead>
                      <TableHead className="py-1 text-xs">Docs</TableHead>
                      <TableHead className="py-1"><button onClick={() => toggleSort('activity')} className="flex items-center gap-1 text-xs font-medium hover:text-foreground">Activiteit <SortIcon k="activity" /></button></TableHead>
                      <TableHead className="py-1 text-right text-xs">Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProfiles.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-xs text-muted-foreground">Geen kandidaten gevonden</TableCell></TableRow>
                    ) : filteredProfiles.map(renderRow)}
                  </TableBody>
                </Table>
              </div>
            )}
          </TooltipProvider>
        </Card>
      )}
    </div>
  );
}
