import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { StickyNote, Plus, Trash2, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Note {
  id: string;
  title: string;
  content: string;
  updated_at: string;
}

interface NotesTileProps {
  userId: string;
}

export function NotesTile({ userId }: NotesTileProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchNotes();
  }, [userId]);

  const fetchNotes = async () => {
    const { data } = await supabase
      .from("user_notes")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(10);
    setNotes((data as Note[]) || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("user_notes").insert({
      user_id: userId,
      title: newTitle.trim(),
      content: newContent.trim(),
    });
    if (error) {
      toast({ title: "Fout", description: "Notitie opslaan mislukt.", variant: "destructive" });
    } else {
      setNewTitle("");
      setNewContent("");
      setAdding(false);
      fetchNotes();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("user_notes").delete().eq("id", id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <Card className="rounded-2xl shadow-door h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold tracking-wide uppercase">Notities</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAdding(!adding)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {adding && (
          <div className="space-y-2 mb-3 p-2.5 rounded-xl border border-border bg-muted/30">
            <Input
              placeholder="Titel"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="h-7 text-sm"
            />
            <Textarea
              placeholder="Notitie..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
            <div className="flex gap-1.5 justify-end">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAdding(false)}>
                Annuleer
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={saving || !newTitle.trim()}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Opslaan"}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nog geen notities. Klik + om te beginnen.
          </p>
        ) : (
          <ScrollArea className="max-h-48">
            <div className="space-y-1.5">
              {notes.map((note) => (
                <div key={note.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{note.title}</p>
                    {note.content && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{note.content}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(note.updated_at).toLocaleDateString("nl-NL")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(note.id)}
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
