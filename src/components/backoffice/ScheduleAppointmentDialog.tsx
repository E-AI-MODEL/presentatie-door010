import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CalendarIcon, Check, ChevronsUpDown, Loader2, CalendarPlus } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ProfileWithEmail } from "./UserOverviewTable";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: ProfileWithEmail[];
  defaultUserId?: string;
  onCreated?: () => void;
}

export function ScheduleAppointmentDialog({ open, onOpenChange, profiles, defaultUserId, onCreated }: Props) {
  // Prefer test@doorai.nl when no default supplied
  const initialUserId = useMemo(() => {
    if (defaultUserId) return defaultUserId;
    const test = profiles.find(p => p.email?.toLowerCase() === "test@doorai.nl");
    return test?.user_id || profiles[0]?.user_id || "";
  }, [defaultUserId, profiles]);

  const [userId, setUserId] = useState(initialUserId);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("10:00");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setUserId(initialUserId); }, [open, initialUserId]);

  const selected = profiles.find(p => p.user_id === userId);
  const label = (p: ProfileWithEmail) =>
    (p.first_name || p.last_name) ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : (p.email || 'Onbekend');

  const handleSubmit = async () => {
    if (!userId || !subject.trim()) {
      toast.error("Kandidaat en onderwerp zijn verplicht");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("appointments").insert({
        user_id: userId,
        subject: subject.trim(),
        message: message.trim() || null,
        preferred_date: date ? format(date, "yyyy-MM-dd") : null,
        preferred_time: time || null,
        status: "confirmed",
      });
      if (error) throw error;

      // Find or create conversation, then post advisor note
      const { data: convs } = await supabase
        .from("conversations").select("id")
        .eq("user_id", userId).order("updated_at", { ascending: false }).limit(1);
      let convId = convs?.[0]?.id;
      if (!convId) {
        const { data: newConv } = await supabase.from("conversations")
          .insert({ user_id: userId, title: "Gesprek met adviseur" })
          .select("id").single();
        convId = newConv?.id;
      }
      if (convId) {
        const dateText = date ? ` op ${format(date, "d MMMM yyyy", { locale: nl })}${time ? ` om ${time}` : ''}` : '';
        await supabase.from("messages").insert({
          conversation_id: convId,
          role: "advisor",
          content: `Ik heb een afspraak ingepland: '${subject.trim()}'${dateText}.`,
        });
      }

      toast.success(`Afspraak ingepland voor ${selected ? label(selected) : 'kandidaat'}`);
      setSubject(""); setMessage(""); setDate(undefined); setTime("10:00");
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      console.error(err);
      toast.error("Kon afspraak niet aanmaken");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarPlus className="h-4 w-4 text-primary" />
            Afspraak inplannen
          </DialogTitle>
          <DialogDescription className="text-xs">
            De afspraak verschijnt direct in de agenda van de gekozen kandidaat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Kandidaat</Label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between h-9 text-sm font-normal">
                  {selected ? `${label(selected)}${selected.email ? ` — ${selected.email}` : ''}` : "Selecteer kandidaat..."}
                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
                <Command>
                  <CommandInput placeholder="Zoek kandidaat..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>Geen kandidaat gevonden.</CommandEmpty>
                    <CommandGroup>
                      {profiles.map((p) => (
                        <CommandItem
                          key={p.user_id}
                          value={`${label(p)} ${p.email || ''}`}
                          onSelect={() => { setUserId(p.user_id); setComboOpen(false); }}
                        >
                          <Check className={cn("mr-2 h-3.5 w-3.5", userId === p.user_id ? "opacity-100" : "opacity-0")} />
                          <span className="flex-1 truncate">{label(p)}</span>
                          {p.email && <span className="text-[10px] text-muted-foreground ml-2 truncate">{p.email}</span>}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Onderwerp</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="bijv. Kennismakingsgesprek" className="h-9 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Datum</Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start h-9 text-sm font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {date ? format(date, "d MMM yyyy", { locale: nl }) : "Kies datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => { setDate(d); setPickerOpen(false); }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tijd</Label>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notitie (optioneel)</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} className="text-sm" placeholder="Korte toelichting voor de kandidaat..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} size="sm">Annuleer</Button>
          <Button onClick={handleSubmit} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CalendarPlus className="h-3.5 w-3.5 mr-1" />}
            Plan afspraak
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
