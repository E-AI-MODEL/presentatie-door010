import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Heart, Plus, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface SavedVacancy {
  id: string;
  title: string;
  organization: string | null;
  url: string | null;
  sector: string | null;
  created_at: string;
}

interface SavedVacanciesTileProps {
  userId: string;
}

export function SavedVacanciesTile({ userId }: SavedVacanciesTileProps) {
  const [vacancies, setVacancies] = useState<SavedVacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newOrg, setNewOrg] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchVacancies();
  }, [userId]);

  const fetchVacancies = async () => {
    const { data } = await supabase
      .from("saved_vacancies")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    setVacancies((data as SavedVacancy[]) || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("saved_vacancies").insert({
      user_id: userId,
      title: newTitle.trim(),
      organization: newOrg.trim() || null,
      url: newUrl.trim() || null,
    });
    if (error) {
      toast({ title: "Fout", description: "Vacature opslaan mislukt.", variant: "destructive" });
    } else {
      setNewTitle("");
      setNewOrg("");
      setNewUrl("");
      setAdding(false);
      fetchVacancies();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("saved_vacancies").delete().eq("id", id);
    setVacancies((prev) => prev.filter((v) => v.id !== id));
  };

  return (
    <Card className="rounded-2xl shadow-door h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold tracking-wide uppercase">Vacatures</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAdding(!adding)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {adding && (
          <div className="space-y-2 mb-3 p-2.5 rounded-xl border border-border bg-muted/30">
            <Input placeholder="Functietitel" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="h-7 text-sm" />
            <Input placeholder="School / organisatie" value={newOrg} onChange={(e) => setNewOrg(e.target.value)} className="h-7 text-sm" />
            <Input placeholder="Link (optioneel)" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="h-7 text-sm" />
            <div className="flex gap-1.5 justify-end">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAdding(false)}>Annuleer</Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={saving || !newTitle.trim()}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Opslaan"}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : vacancies.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Sla interessante vacatures op vanuit de vacaturepagina of voeg ze hier toe.
          </p>
        ) : (
          <ScrollArea className="max-h-48">
            <div className="space-y-1.5">
              {vacancies.map((v) => (
                <div key={v.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground truncate">{v.title}</p>
                      {v.url && (
                        <a href={v.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <ExternalLink className="h-3 w-3 text-primary" />
                        </a>
                      )}
                    </div>
                    {v.organization && <p className="text-xs text-muted-foreground">{v.organization}</p>}
                    {v.sector && <Badge variant="outline" className="text-[9px] mt-0.5">{v.sector}</Badge>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(v.id)}
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
