import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, ExternalLink, Trash2, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "react-router-dom";

interface SavedEvent {
  id: string;
  event_title: string;
  event_date: string | null;
  event_url: string | null;
  event_source: string | null;
  created_at: string;
}

interface SavedEventsTileProps {
  userId: string;
}

export function SavedEventsTile({ userId }: SavedEventsTileProps) {
  const [events, setEvents] = useState<SavedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, [userId]);

  const fetchEvents = async () => {
    const { data } = await supabase
      .from("saved_events")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    setEvents((data as SavedEvent[]) || []);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("saved_events").delete().eq("id", id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <Card className="rounded-2xl shadow-door h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold tracking-wide uppercase">Mijn events</span>
          </div>
          <Link to="/events" className="text-[10px] text-primary hover:underline">
            Agenda →
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : events.length === 0 ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              Je hebt nog geen events opgeslagen.
            </p>
            <Button variant="outline" size="sm" className="text-xs h-7" asChild>
              <Link to="/events">Bekijk de agenda</Link>
            </Button>
          </div>
        ) : (
          <ScrollArea className="max-h-48">
            <div className="space-y-1.5">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground truncate">{event.event_title}</p>
                      {event.event_url && (
                        <a href={event.event_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <ExternalLink className="h-3 w-3 text-primary" />
                        </a>
                      )}
                    </div>
                    {event.event_date && <p className="text-xs text-muted-foreground">{event.event_date}</p>}
                    {event.event_source && <p className="text-[10px] text-muted-foreground">{event.event_source}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(event.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
