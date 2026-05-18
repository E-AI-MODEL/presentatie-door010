import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  User, X, FileText, ClipboardCheck, Calendar, Bookmark,
  BookmarkCheck, StickyNote, Phone, Mail, GraduationCap, Download, ExternalLink,
  MessageCircle, Loader2, Save
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ProfileWithEmail, Appointment, SavedEvent, SavedVacancy, UserNote } from "./UserOverviewTable";

interface AdvisorNote {
  id: string;
  advisor_user_id: string;
  candidate_user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface CandidateDetailPanelProps {
  user: ProfileWithEmail | null;
  onClose: () => void;
  onOpenChat: () => void;
  onRefresh?: () => void;
}

const phaseLabels: Record<string, string> = {
  interesseren: 'Interesseren',
  orienteren: 'Oriënteren',
  beslissen: 'Beslissen',
  matchen: 'Matchen',
  voorbereiden: 'Voorbereiden',
};

const sectorLabels: Record<string, string> = {
  po: 'Primair Onderwijs',
  vo: 'Voortgezet Onderwijs',
  mbo: 'MBO',
  so: 'Speciaal Onderwijs',
  onbekend: 'Nog onbekend',
};

const PHASES = ['interesseren', 'orienteren', 'beslissen', 'matchen', 'voorbereiden'] as const;

export function CandidateDetailPanel({ user, onClose, onOpenChat, onRefresh }: CandidateDetailPanelProps) {
  const { user: authUser } = useAuth();
  const [selectedPhase, setSelectedPhase] = useState<string>('');
  const [updatingPhase, setUpdatingPhase] = useState(false);
  const [advisorNotes, setAdvisorNotes] = useState<AdvisorNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Load advisor notes when user changes
  useEffect(() => {
    if (user) {
      setSelectedPhase(user.current_phase || 'interesseren');
      loadAdvisorNotes(user.user_id);
    }
  }, [user?.user_id]);

  const loadAdvisorNotes = async (candidateId: string) => {
    const { data } = await supabase
      .from('advisor_notes')
      .select('*')
      .eq('candidate_user_id', candidateId)
      .order('created_at', { ascending: false });
    setAdvisorNotes(data || []);
  };

  const handlePhaseUpdate = async () => {
    if (!user || selectedPhase === user.current_phase) return;
    setUpdatingPhase(true);
    try {
      await supabase
        .from('profiles')
        .update({ current_phase: selectedPhase as any })
        .eq('user_id', user.user_id);
      onRefresh?.();
    } catch (err) {
      console.error('Error updating phase:', err);
    } finally {
      setUpdatingPhase(false);
    }
  };

  const handleSaveNote = async () => {
    if (!user || !newNote.trim() || !authUser) return;
    setSavingNote(true);
    try {
      await supabase
        .from('advisor_notes')
        .insert({
          advisor_user_id: authUser.id,
          candidate_user_id: user.user_id,
          content: newNote.trim(),
        });
      setNewNote('');
      loadAdvisorNotes(user.user_id);
    } catch (err) {
      console.error('Error saving note:', err);
    } finally {
      setSavingNote(false);
    }
  };

  if (!user) {
    return (
      <Card className="h-full flex items-center justify-center bg-muted/20">
        <div className="text-center p-8">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium text-foreground mb-2">Selecteer een kandidaat</h3>
          <p className="text-sm text-muted-foreground">
            Klik op een kandidaat om het volledige profiel te bekijken.
          </p>
        </div>
      </Card>
    );
  }

  const fullName = user.first_name && user.last_name
    ? `${user.first_name} ${user.last_name}`
    : user.first_name || 'Niet ingevuld';

  const appointments: Appointment[] = user.appointments || [];
  const savedEvents: SavedEvent[] = user.saved_events || [];
  const savedVacancies: SavedVacancy[] = user.saved_vacancies || [];
  const userNotes: UserNote[] = user.user_notes || [];
  const testResults = user.test_results as Record<string, unknown> | null;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {fullName}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="text-primary" onClick={onOpenChat}>
              <MessageCircle className="h-4 w-4 mr-1" /> Chat
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {user.preferred_sector && (
            <Badge variant="secondary">
              {sectorLabels[user.preferred_sector] || user.preferred_sector}
            </Badge>
          )}
        </div>
        {/* Phase selector (punt 8) */}
        <div className="flex items-center gap-2 mt-3">
          <Select value={selectedPhase} onValueChange={setSelectedPhase}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PHASES.map(p => (
                <SelectItem key={p} value={p}>{phaseLabels[p] || p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPhase !== user.current_phase && (
            <Button size="sm" variant="default" className="h-8 text-xs" onClick={handlePhaseUpdate} disabled={updatingPhase}>
              {updatingPhase ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Opslaan'}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-[500px]">
          <div className="p-4 space-y-5">
            {/* Contact */}
            <Section title="Contact">
              <div className="space-y-2 text-sm">
                {user.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{user.email}</span>
                  </div>
                )}
                {user.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{user.phone}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Lid sinds {format(new Date(user.created_at), 'd MMMM yyyy', { locale: nl })}
                </p>
              </div>
            </Section>

            {/* Documenten */}
            <Section title="Documenten & Test">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className={`h-4 w-4 ${user.cv_url ? 'text-primary' : 'text-muted-foreground/40'}`} />
                    <span>{user.cv_url ? 'CV geüpload' : 'Geen CV'}</span>
                  </div>
                  {user.cv_url && (
                    <Button variant="ghost" size="sm" onClick={() => window.open(user.cv_url!, '_blank')}>
                      <Download className="h-3 w-3 mr-1" /> Download
                    </Button>
                  )}
                </div>
                {user.test_completed && (
                  <div className="flex items-center gap-2 text-sm">
                    <ClipboardCheck className="h-4 w-4 text-primary" />
                    <span>Interessetest voltooid</span>
                  </div>
                )}
                {user.test_completed && testResults && Object.keys(testResults).length > 0 && (() => {
                  const results = testResults as { recommendedSector?: string; sectorScores?: Record<string, number>; ranking?: { sector: string; score: number }[]; answers?: Record<string, string>; completedAt?: string };
                  const sectorLabels: Record<string, string> = { po: "Primair Onderwijs", vo: "Voortgezet Onderwijs", mbo: "MBO", so: "Speciaal Onderwijs" };
                  return (
                    <div className="bg-muted/50 rounded-lg p-3 mt-2">
                      <p className="text-xs font-medium mb-2">Testresultaten:</p>
                      <div className="space-y-1.5">
                        {results.recommendedSector && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Aanbevolen sector</span>
                            <span className="font-semibold text-primary">{sectorLabels[results.recommendedSector] || results.recommendedSector}</span>
                          </div>
                        )}
                        {results.ranking?.map(({ sector, score }, i) => (
                          <div key={sector} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{i + 1}. {sectorLabels[sector] || sector}</span>
                            <span className="font-medium">{score} punten</span>
                          </div>
                        ))}
                        {results.completedAt && (
                          <div className="flex justify-between text-xs pt-1 border-t border-border">
                            <span className="text-muted-foreground">Voltooid op</span>
                            <span className="font-medium">{new Date(results.completedAt).toLocaleDateString('nl-NL')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </Section>

            {/* Afspraken */}
            <Section title={`Afspraken (${appointments.length})`}>
              {appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Geen afspraken</p>
              ) : (
                <div className="space-y-2">
                  {appointments.slice(0, 5).map((apt: any) => (
                    <div key={apt.id} className="bg-muted/50 rounded-lg p-2.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{apt.subject}</span>
                        <Badge variant={apt.status === 'pending' ? 'secondary' : apt.status === 'confirmed' ? 'default' : 'outline'} className="text-xs">
                          {apt.status === 'pending' ? 'In afwachting' : apt.status === 'confirmed' ? 'Bevestigd' : apt.status}
                        </Badge>
                      </div>
                      {apt.preferred_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <Calendar className="h-3 w-3 inline mr-1" />
                          {format(new Date(apt.preferred_date), 'd MMM yyyy', { locale: nl })}
                          {apt.preferred_time && ` om ${apt.preferred_time}`}
                        </p>
                      )}
                      {apt.message && <p className="text-xs text-muted-foreground mt-1">{apt.message}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Opgeslagen vacatures */}
            <Section title={`Vacatures (${savedVacancies.length})`}>
              {savedVacancies.length === 0 ? (
                <p className="text-sm text-muted-foreground">Geen opgeslagen vacatures</p>
              ) : (
                <div className="space-y-2">
                  {savedVacancies.slice(0, 5).map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{v.title}</p>
                        {v.organization && <p className="text-xs text-muted-foreground">{v.organization}</p>}
                      </div>
                      {v.url && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => window.open(v.url, '_blank')}>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Opgeslagen events */}
            <Section title={`Events (${savedEvents.length})`}>
              {savedEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Geen opgeslagen events</p>
              ) : (
                <div className="space-y-2">
                  {savedEvents.slice(0, 5).map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{e.event_title}</p>
                        {e.event_date && <p className="text-xs text-muted-foreground">{e.event_date}</p>}
                      </div>
                      {e.event_url && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => window.open(e.event_url, '_blank')}>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Kandidaat Notities */}
            <Section title={`Notities kandidaat (${userNotes.length})`}>
              {userNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Geen notities</p>
              ) : (
                <div className="space-y-2">
                  {userNotes.slice(0, 5).map((n) => (
                    <div key={n.id} className="bg-muted/50 rounded-lg p-2.5 text-sm">
                      <p className="font-medium">{n.title || 'Zonder titel'}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{n.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Interne Advisor Notities (punt 11) */}
            <Section title={`Interne notities (${advisorNotes.length})`}>
              <div className="space-y-2">
                {advisorNotes.map((n) => (
                  <div key={n.id} className="bg-primary/5 border border-primary/10 rounded-lg p-2.5 text-sm">
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(n.created_at), 'd MMM yyyy HH:mm', { locale: nl })}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{n.content}</p>
                  </div>
                ))}
                <div className="space-y-2 mt-2">
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Interne notitie toevoegen..."
                    className="text-xs min-h-[60px]"
                  />
                  <Button size="sm" onClick={handleSaveNote} disabled={savingNote || !newNote.trim()}>
                    {savingNote ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                    Opslaan
                  </Button>
                </div>
              </div>
            </Section>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</h4>
      {children}
      <Separator className="mt-4" />
    </div>
  );
}
