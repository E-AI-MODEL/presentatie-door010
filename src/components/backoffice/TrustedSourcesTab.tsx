import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Globe, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface TrustedSource {
  id: string;
  url: string;
  label: string;
  category: string;
  active: boolean;
  created_at: string;
}

/** Ensure URL has https:// protocol. Returns null if invalid. */
function normalizeUrl(raw: string): string | null {
  let url = raw.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function TrustedSourcesTab() {
  const [sources, setSources] = useState<TrustedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState("algemeen");

  const fetchSources = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("trusted_sources")
      .select("*")
      .order("category", { ascending: true });
    if (error) {
      toast.error("Kon bronnen niet laden");
      console.error(error);
    } else {
      setSources(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const handleAdd = async () => {
    if (!newUrl.trim() || !newLabel.trim()) {
      toast.error("Vul URL en label in");
      return;
    }
    const normalized = normalizeUrl(newUrl);
    if (!normalized) {
      toast.error("Ongeldige URL. Gebruik bijv. https://duo.nl");
      return;
    }
    const { error } = await supabase.from("trusted_sources").insert({
      url: normalized,
      label: newLabel.trim(),
      category: newCategory.trim() || "algemeen",
    });
    if (error) {
      toast.error("Kon bron niet toevoegen");
    } else {
      toast.success("Bron toegevoegd");
      setNewUrl("");
      setNewLabel("");
      setNewCategory("algemeen");
      fetchSources();
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from("trusted_sources").update({ active }).eq("id", id);
    if (error) {
      toast.error("Kon status niet wijzigen");
    } else {
      setSources(prev => prev.map(s => s.id === id ? { ...s, active } : s));
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("trusted_sources").delete().eq("id", id);
    if (error) {
      toast.error("Kon bron niet verwijderen");
    } else {
      toast.success("Bron verwijderd");
      setSources(prev => prev.filter(s => s.id !== id));
    }
  };

  const categories = [...new Set(sources.map(s => s.category))].sort();

  return (
    <div className="space-y-4">
      {/* Add form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nieuwe bron toevoegen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="https://duo.nl"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              className="flex-1 text-sm h-9"
            />
            <Input
              placeholder="Label (bijv. DUO)"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              className="w-full sm:w-40 text-sm h-9"
            />
            <Input
              placeholder="Categorie"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="w-full sm:w-32 text-sm h-9"
            />
            <Button size="sm" onClick={handleAdd} className="h-9">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Toevoegen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sources list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Vertrouwde bronnen ({sources.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchSources} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Laden...</div>
          ) : sources.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Nog geen bronnen toegevoegd.</div>
          ) : (
            <div className="space-y-4">
              {categories.map(cat => (
                <div key={cat}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{cat}</h3>
                  <div className="space-y-1">
                    {sources.filter(s => s.category === cat).map(source => (
                      <div
                        key={source.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${source.active ? "bg-card" : "bg-muted/50 opacity-60"}`}
                      >
                        <Switch
                          checked={source.active}
                          onCheckedChange={checked => handleToggle(source.id, checked)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{source.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{source.url}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">{source.category}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => handleDelete(source.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
