import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Phone, Plus, Loader2, Clock, CheckCircle2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Appointment {
  id: string;
  subject: string;
  message: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  status: string;
  created_at: string;
}

interface AppointmentTileProps {
  userId: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "In behandeling", className: "bg-accent/15 text-accent border-0" },
  confirmed: { label: "Bevestigd", className: "bg-primary/15 text-primary border-0" },
  completed: { label: "Afgerond", className: "bg-muted text-muted-foreground border-0" },
  cancelled: { label: "Geannuleerd", className: "bg-destructive/15 text-destructive border-0" },
};

export function AppointmentTile({ userId }: AppointmentTileProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [prefDate, setPrefDate] = useState("");
  const [prefTime, setPrefTime] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAppointments();
  }, [userId]);

  const fetchAppointments = async () => {
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    setAppointments((data as Appointment[]) || []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!subject.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("appointments").insert({
      user_id: userId,
      subject: subject.trim(),
      message: message.trim() || null,
      preferred_date: prefDate || null,
      preferred_time: prefTime || null,
    });
    if (error) {
      toast({ title: "Fout", description: "Aanvraag mislukt.", variant: "destructive" });
    } else {
      toast({ title: "Aanvraag verstuurd", description: "We nemen zo snel mogelijk contact met je op." });
      setSubject("");
      setMessage("");
      setPrefDate("");
      setPrefTime("");
      setAdding(false);
      fetchAppointments();
    }
    setSaving(false);
  };

  return (
    <Card className="rounded-2xl shadow-door h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold tracking-wide uppercase">Contact</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAdding(!adding)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {adding && (
          <div className="space-y-2 mb-3 p-2.5 rounded-xl border border-border bg-muted/30">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Onderwerp</Label>
              <Input placeholder="Waar gaat het over?" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-7 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Bericht (optioneel)</Label>
              <Textarea placeholder="Toelichting..." value={message} onChange={(e) => setMessage(e.target.value)} rows={2} className="text-sm resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Voorkeursdatum</Label>
                <Input type="date" value={prefDate} onChange={(e) => setPrefDate(e.target.value)} className="h-7 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Tijd</Label>
                <Input placeholder="bijv. ochtend" value={prefTime} onChange={(e) => setPrefTime(e.target.value)} className="h-7 text-sm" />
              </div>
            </div>
            <div className="flex gap-1.5 justify-end">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAdding(false)}>Annuleer</Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleSubmit} disabled={saving || !subject.trim()}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verstuur"}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              Plan een afspraak met het Onderwijsloket.
            </p>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setAdding(true)}>
              <Plus className="h-3 w-3 mr-1" />
              Afspraak aanvragen
            </Button>
          </div>
        ) : (
          <ScrollArea className="max-h-48">
            <div className="space-y-1.5">
              {appointments.map((apt) => {
                const status = statusConfig[apt.status] || statusConfig.pending;
                return (
                  <div key={apt.id} className="p-2 rounded-lg hover:bg-muted/50">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{apt.subject}</p>
                      <Badge className={`text-[9px] shrink-0 ${status.className}`}>
                        {apt.status === "pending" && <Clock className="h-2.5 w-2.5 mr-0.5" />}
                        {apt.status === "confirmed" && <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />}
                        {status.label}
                      </Badge>
                    </div>
                    {apt.preferred_date && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(apt.preferred_date).toLocaleDateString("nl-NL")}
                        {apt.preferred_time && ` - ${apt.preferred_time}`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
