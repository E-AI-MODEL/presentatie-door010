import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, User, CheckCircle, XCircle, Loader2, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ProfileWithEmail, Appointment } from "./UserOverviewTable";

interface AppointmentsTabProps {
  profiles: ProfileWithEmail[];
  onSelectUser: (profile: ProfileWithEmail) => void;
  onOpenChat: (profile: ProfileWithEmail) => void;
  onRefresh?: () => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "In afwachting", variant: "secondary" },
  confirmed: { label: "Bevestigd", variant: "default" },
  completed: { label: "Afgerond", variant: "outline" },
  cancelled: { label: "Geannuleerd", variant: "destructive" },
};

export function AppointmentsTab({ profiles, onSelectUser, onOpenChat, onRefresh }: AppointmentsTabProps) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [localUpdates, setLocalUpdates] = useState<Record<string, Partial<Appointment>>>({});
  const isMobile = useIsMobile();

  const allAppointments: (Appointment & { userName: string; profile: ProfileWithEmail })[] = [];
  for (const p of profiles) {
    const apts: Appointment[] = p.appointments || [];
    const name = p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.email || 'Onbekend';
    for (const apt of apts) {
      allAppointments.push({ ...apt, ...localUpdates[apt.id], userName: name, profile: p });
    }
  }

  allAppointments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filtered = statusFilter === "all"
    ? allAppointments
    : allAppointments.filter(a => a.status === statusFilter);

  const sendAppointmentNotification = async (apt: Appointment & { userName: string; profile: ProfileWithEmail }, newStatus: string) => {
    try {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", apt.user_id)
        .order("updated_at", { ascending: false })
        .limit(1);

      let convId: string;
      if (convs && convs.length > 0) {
        convId = convs[0].id;
      } else {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({ user_id: apt.user_id, title: "Gesprek met adviseur" })
          .select("id")
          .single();
        if (!newConv) return;
        convId = newConv.id;
      }

      const statusText = newStatus === 'confirmed' ? 'bevestigd' : newStatus === 'cancelled' ? 'geannuleerd' : newStatus === 'completed' ? 'afgerond' : newStatus;
      const dateText = apt.preferred_date ? ` voor ${format(new Date(apt.preferred_date), 'd MMMM yyyy', { locale: nl })}` : '';
      const content = `📋 Je afspraak '${apt.subject}' is **${statusText}**${dateText}.`;

      await supabase.from("messages").insert({
        conversation_id: convId,
        role: "advisor",
        content,
      });
    } catch (err) {
      console.error("Error sending appointment notification:", err);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus })
        .eq("id", id);
      if (!error) {
        setLocalUpdates(prev => ({ ...prev, [id]: { ...prev[id], status: newStatus } }));
        const apt = allAppointments.find(a => a.id === id);
        if (apt) await sendAppointmentNotification(apt, newStatus);
        onRefresh?.();
      }
    } catch (err) {
      console.error("Error updating appointment:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const saveNotes = async (id: string) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ advisor_notes: notesValue })
        .eq("id", id);
      if (!error) {
        setLocalUpdates(prev => ({ ...prev, [id]: { ...prev[id], advisor_notes: notesValue } }));
        setEditingNotesId(null);
      }
    } catch (err) {
      console.error("Error saving notes:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const renderStatusActions = (apt: Appointment & { userName: string; profile: ProfileWithEmail }) => (
    <div className="flex items-center gap-1">
      <Button
        size="sm" variant="ghost" className="text-primary h-8"
        onClick={(e) => { e.stopPropagation(); onOpenChat(apt.profile); }}
        title="Reageer via chat"
      >
        <MessageSquare className="h-4 w-4" />
      </Button>
      {apt.status === 'pending' && (
        <>
          <Button
            size="sm" variant="ghost" className="text-primary h-8"
            onClick={(e) => { e.stopPropagation(); updateStatus(apt.id, 'confirmed'); }}
            disabled={updatingId === apt.id}
          >
            <CheckCircle className="h-4 w-4" />
          </Button>
          <Button
            size="sm" variant="ghost" className="text-destructive h-8"
            onClick={(e) => { e.stopPropagation(); updateStatus(apt.id, 'cancelled'); }}
            disabled={updatingId === apt.id}
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </>
      )}
      {apt.status === 'confirmed' && (
        <Button
          size="sm" variant="ghost" className="text-primary h-8"
          onClick={(e) => { e.stopPropagation(); updateStatus(apt.id, 'completed'); }}
          disabled={updatingId === apt.id}
        >
          Afronden
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground text-sm md:text-base">Alle afspraken</h3>
          <Badge variant="secondary">{allAppointments.length}</Badge>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] md:w-[160px]">
            <SelectValue placeholder="Alle statussen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="pending">In afwachting</SelectItem>
            <SelectItem value="confirmed">Bevestigd</SelectItem>
            <SelectItem value="completed">Afgerond</SelectItem>
            <SelectItem value="cancelled">Geannuleerd</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isMobile ? (
        /* Mobile: Card view */
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Geen afspraken gevonden
            </div>
          ) : (
            filtered.map((apt) => {
              const config = statusConfig[apt.status] || statusConfig.pending;
              return (
                <Card key={apt.id} className="p-3">
                  <div className="space-y-2">
                    {/* Header: name + status */}
                    <div className="flex items-center justify-between">
                      <button
                        className="text-sm font-medium text-primary hover:underline"
                        onClick={() => onSelectUser(apt.profile)}
                      >
                        {apt.userName}
                      </button>
                      <Badge variant={config.variant} className="text-xs">
                        {config.label}
                      </Badge>
                    </div>

                    {/* Subject */}
                    <p className="text-sm font-medium">{apt.subject}</p>

                    {/* Message */}
                    {apt.message && (
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">{apt.message}</p>
                    )}

                    {/* Date */}
                    {apt.preferred_date && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(apt.preferred_date), 'd MMM yyyy', { locale: nl })}</span>
                        {apt.preferred_time && (
                          <>
                            <Clock className="h-3 w-3 ml-1" />
                            <span>{apt.preferred_time}</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    {editingNotesId === apt.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          className="text-xs min-h-[60px]"
                          placeholder="Notitie toevoegen..."
                        />
                        <div className="flex gap-1">
                          <Button size="sm" variant="default" onClick={() => saveNotes(apt.id)} disabled={updatingId === apt.id}>
                            {updatingId === apt.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Opslaan'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingNotesId(null)}>Annuleer</Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => { setEditingNotesId(apt.id); setNotesValue(apt.advisor_notes || ""); }}
                      >
                        {apt.advisor_notes ? `📝 ${apt.advisor_notes}` : '+ Notitie'}
                      </button>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end pt-1 border-t border-border">
                      {renderStatusActions(apt)}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        /* Desktop: Table view */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Kandidaat</TableHead>
                  <TableHead>Onderwerp</TableHead>
                  <TableHead>Datum/Tijd</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notities</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Geen afspraken gevonden
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((apt) => {
                    const config = statusConfig[apt.status] || statusConfig.pending;
                    return (
                      <TableRow key={apt.id} className="hover:bg-muted/30">
                        <TableCell>
                          <button
                            className="text-sm font-medium text-primary hover:underline"
                            onClick={() => onSelectUser(apt.profile)}
                          >
                            {apt.userName}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{apt.subject}</p>
                            {apt.message && (
                              <p className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded p-1.5">{apt.message}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {apt.preferred_date ? (
                            <div className="text-sm">
                              <p>{format(new Date(apt.preferred_date), 'd MMM yyyy', { locale: nl })}</p>
                              {apt.preferred_time && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> {apt.preferred_time}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Geen voorkeur</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={config.variant} className="text-xs">
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {editingNotesId === apt.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={notesValue}
                                onChange={(e) => setNotesValue(e.target.value)}
                                className="text-xs min-h-[60px]"
                                placeholder="Notitie toevoegen..."
                              />
                              <div className="flex gap-1">
                                <Button size="sm" variant="default" onClick={() => saveNotes(apt.id)} disabled={updatingId === apt.id}>
                                  {updatingId === apt.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Opslaan'}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingNotesId(null)}>Annuleer</Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              className="text-xs text-muted-foreground hover:text-foreground text-left"
                              onClick={() => { setEditingNotesId(apt.id); setNotesValue(apt.advisor_notes || ""); }}
                            >
                              {apt.advisor_notes || '+ Notitie toevoegen'}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {renderStatusActions(apt)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
