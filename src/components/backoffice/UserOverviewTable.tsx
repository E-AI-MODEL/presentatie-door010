import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PhaseStatusBar } from "./PhaseStatusBar";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  Users, 
  Search, 
  Phone,
  MessageCircle,
  FileText,
  Download,
  ClipboardCheck,
  User
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

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
  id: string;
  user_id: string;
  event_title: string;
  event_date: string | null;
  event_url: string | null;
  event_source: string | null;
  created_at: string;
}

export interface SavedVacancy {
  id: string;
  user_id: string;
  title: string;
  organization: string | null;
  url: string | null;
  sector: string | null;
  notes: string | null;
  created_at: string;
}

export interface UserNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
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
  interesseren: { label: 'Interesseren', color: 'bg-accent/10 text-accent border-accent/20' },
  orienteren: { label: 'Oriënteren', color: 'bg-primary/10 text-primary border-primary/20' },
  beslissen: { label: 'Beslissen', color: 'bg-primary/20 text-primary border-primary/30' },
  matchen: { label: 'Matchen', color: 'bg-accent/20 text-accent border-accent/30' },
  voorbereiden: { label: 'Voorbereiden', color: 'bg-primary/15 text-primary border-primary/25' },
};

const sectorLabels: Record<string, string> = {
  po: 'Primair Onderwijs',
  vo: 'Voortgezet Onderwijs',
  mbo: 'MBO',
  so: 'Speciaal Onderwijs',
  onbekend: 'Nog onbekend',
};

interface UserOverviewTableProps {
  profiles: ProfileWithEmail[];
  onSelectUser: (profile: ProfileWithEmail) => void;
  selectedUserId?: string;
}

export function UserOverviewTable({ profiles, onSelectUser, selectedUserId }: UserOverviewTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const isMobile = useIsMobile();

  const filteredProfiles = profiles.filter((profile) => {
    const matchesSearch = 
      !searchQuery ||
      profile.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.phone?.includes(searchQuery);
    
    const matchesPhase = phaseFilter === "all" || profile.current_phase === phaseFilter;
    const matchesSector = sectorFilter === "all" || profile.preferred_sector === sectorFilter;
    
    return matchesSearch && matchesPhase && matchesSector;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-card rounded-lg border border-border p-3 md:p-4">
        <div className="flex flex-col gap-3 md:gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek op naam, email of telefoon..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className="flex-1 md:w-[160px] md:flex-none">
                <SelectValue placeholder="Alle fases" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle fases</SelectItem>
                {Object.entries(phaseLabels).map(([value, { label }]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="flex-1 md:w-[180px] md:flex-none">
                <SelectValue placeholder="Alle sectoren" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle sectoren</SelectItem>
                {Object.entries(sectorLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Mobile: Card view */}
      {isMobile ? (
        <div className="space-y-3">
          {filteredProfiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Geen kandidaten gevonden
            </div>
          ) : (
            filteredProfiles.map((profile) => {
              const initials = `${profile.first_name?.charAt(0) || ''}${profile.last_name?.charAt(0) || ''}`.toUpperCase();
              return (
                <Card
                  key={profile.id}
                  className={`p-3 cursor-pointer active:scale-[0.98] transition-transform overflow-hidden ${
                    selectedUserId === profile.user_id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => onSelectUser(profile)}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={profile.avatar_url || undefined} alt="Avatar" />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {initials || <User className="h-4 w-4" />}
                        </AvatarFallback>
                      </Avatar>
                      {(profile.unread_messages ?? 0) > 0 && (
                        <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">
                          {profile.unread_messages}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-foreground truncate">
                          {profile.first_name && profile.last_name 
                            ? `${profile.first_name} ${profile.last_name}`
                            : profile.first_name || 'Niet ingevuld'}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {profile.last_message_at 
                            ? format(new Date(profile.last_message_at), 'd MMM', { locale: nl })
                            : format(new Date(profile.created_at), 'd MMM', { locale: nl })}
                        </span>
                      </div>

                      {/* Phase bar */}
                      <div className="mt-1.5">
                        <PhaseStatusBar profile={profile} />
                      </div>

                      {/* Bottom row: docs + chat */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <FileText className={`h-3.5 w-3.5 ${profile.cv_url ? 'text-primary' : 'text-muted-foreground/30'}`} />
                          <ClipboardCheck className={`h-3.5 w-3.5 ${profile.test_completed ? 'text-primary' : 'text-muted-foreground/30'}`} />
                          {profile.phone && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Phone className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectUser(profile);
                          }}
                        >
                          <MessageCircle className="h-3.5 w-3.5 mr-1" />
                          Bekijk
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        /* Desktop: Table view */
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Kandidaat</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Fase</TableHead>
                  <TableHead>Documenten</TableHead>
                  <TableHead>Laatste activiteit</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Geen kandidaten gevonden
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProfiles.map((profile) => {
                    const initials = `${profile.first_name?.charAt(0) || ''}${profile.last_name?.charAt(0) || ''}`.toUpperCase();
                    
                    return (
                      <TableRow 
                        key={profile.id} 
                        className={`hover:bg-muted/30 cursor-pointer ${selectedUserId === profile.user_id ? 'bg-primary/5' : ''}`}
                        onClick={() => onSelectUser(profile)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={profile.avatar_url || undefined} alt="Avatar" />
                                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                  {initials || <User className="h-4 w-4" />}
                                </AvatarFallback>
                              </Avatar>
                              {(profile.unread_messages ?? 0) > 0 && (
                                <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">
                                  {profile.unread_messages}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                {profile.first_name && profile.last_name 
                                  ? `${profile.first_name} ${profile.last_name}`
                                  : profile.first_name || 'Niet ingevuld'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {profile.email || 'Geen email'}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {profile.phone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                <span>{profile.phone}</span>
                              </div>
                            )}
                            {!profile.phone && (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[200px]">
                          <PhaseStatusBar profile={profile} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-8 w-8 ${profile.cv_url ? 'text-primary' : 'text-muted-foreground/40'}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (profile.cv_url) {
                                      window.open(profile.cv_url, '_blank');
                                    }
                                  }}
                                  disabled={!profile.cv_url}
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {profile.cv_url ? 'CV downloaden' : 'Geen CV geüpload'}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={`h-8 w-8 flex items-center justify-center rounded ${profile.test_completed ? 'text-primary' : 'text-muted-foreground/40'}`}>
                                  <ClipboardCheck className="h-4 w-4" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {profile.test_completed ? 'Interessetest voltooid' : 'Interessetest niet gedaan'}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {profile.last_message_at 
                              ? format(new Date(profile.last_message_at), 'd MMM HH:mm', { locale: nl })
                              : format(new Date(profile.created_at), 'd MMM yyyy', { locale: nl })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectUser(profile);
                            }}
                          >
                            <MessageCircle className="h-4 w-4 mr-1" />
                            Chat
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TooltipProvider>
        </div>
      )}

      <p className="text-sm text-muted-foreground text-center">
        {filteredProfiles.length} van {profiles.length} kandidaten getoond
      </p>
    </div>
  );
}
