import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Globe, RefreshCw, ChevronDown, ShieldCheck, ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TrustedSource {
  id: string;
  url: string;
  label: string;
  category: string;
  active: boolean;
  created_at: string;
}

function normalizeUrl(raw: string): string | null {
  let url = raw.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch { return null; }
}

export function TrustedSourcesTab() {
  const [sources, setSources] = useState<TrustedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState("algemeen");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [query, setQuery] = useState("");
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchSources = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("trusted_sources").select("*").order("category");
    if (error) toast.error("Kon bronnen niet laden");
    else setSources(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sources.filter(s => {
      if (filter === "active" && !s.active) return false;
      if (filter === "inactive" && s.active) return false;
      if (q && !s.label.toLowerCase().includes(q) && !s.url.toLowerCase().includes(q) && !s.category.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sources, filter, query]);

  const grouped = useMemo(() => {
    const out: Record<string, TrustedSource[]> = {};
    for (const s of filtered) (out[s.category] ||= []).push(s);
    return out;
  }, [filtered]);

  const handleAdd = async () => {
    if (!newUrl.trim() || !newLabel.trim()) return toast.error("Vul URL en label in");
    const normalized = normalizeUrl(newUrl);
    if (!normalized) return toast.error("Ongeldige URL");
    const { error } = await supabase.from("trusted_sources").insert({
      url: normalized, label: newLabel.trim(), category: newCategory.trim() || "algemeen",
    });
    if (error) toast.error("Kon bron niet toevoegen");
    else { toast.success("Bron toegevoegd"); setNewUrl(""); setNewLabel(""); fetchSources(); }
  };

  const handleToggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from("trusted_sources").update({ active }).eq("id", id);
    if (error) toast.error("Wijziging mislukt");
    else setSources(prev => prev.map(s => s.id === id ? { ...s, active } : s));
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("trusted_sources").delete().eq("id", id);
    if (error) toast.error("Verwijderen mislukt");
    else {
      setSources(prev => prev.filter(s => s.id !== id));
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const bulkToggle = async (active: boolean) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const { error } = await supabase.from("trusted_sources").update({ active }).in("id", ids);
    if (error) toast.error("Wijziging mislukt");
    else {
      setSources(prev => prev.map(s => selected.has(s.id) ? { ...s, active } : s));
      toast.success(`${ids.length} bron(nen) ${active ? 'actief' : 'inactief'}`);
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const { error } = await supabase.from("trusted_sources").delete().in("id", ids);
    if (error) toast.error("Verwijderen mislukt");
    else {
      setSources(prev => prev.filter(s => !selected.has(s.id)));
      setSelected(new Set());
      toast.success(`${ids.length} bron(nen) verwijderd`);
    }
  };

  const toggleCat = (cat: string) => setOpenCats(p => ({ ...p, [cat]: p[cat] === false ? true : false }));
  const isOpen = (cat: string) => openCats[cat] !== false;

  const activeCount = sources.filter(s => s.active).length;

  return (
    <div className="space-y-3">
      {/* Status bar — confirms whitelist is wired into chat */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/20 bg-primary/5 text-xs">
        <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
        <span className="flex-1 text-foreground">
          <strong>Whitelist actief in persoonlijke chat.</strong> Externe links worden gefilterd; alleen actieve bronnen worden gebruikt voor live updates (Firecrawl).
        </span>
        <Badge variant="outline" className="text-[10px]">{activeCount}/{sources.length} actief</Badge>
      </div>

      {/* Inline composer */}
      <Card className="p-2">
        <div className="flex flex-col sm:flex-row gap-1.5">
          <Input placeholder="https://duo.nl" value={newUrl} onChange={e => setNewUrl(e.target.value)} className="flex-1 h-8 text-xs" />
          <Input placeholder="Label" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="w-full sm:w-36 h-8 text-xs" />
          <Input placeholder="Categorie" value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full sm:w-28 h-8 text-xs" />
          <Button size="sm" onClick={handleAdd} className="h-8 text-xs">
            <Plus className="h-3 w-3 mr-1" />Toevoegen
          </Button>
        </div>
      </Card>

      {/* Filter strip */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-md border border-border overflow-hidden">
          {(["all", "active", "inactive"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("px-2.5 py-1 text-[11px] font-medium",
                filter === f ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
              {f === "all" ? "Alles" : f === "active" ? "Actief" : "Inactief"}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input placeholder="Zoek..." value={query} onChange={e => setQuery(e.target.value)} className="pl-7 h-7 text-xs" />
        </div>
        {selected.size > 0 && (
          <>
            <Badge variant="secondary" className="text-[10px]">{selected.size} geselecteerd</Badge>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => bulkToggle(true)}>Activeer</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => bulkToggle(false)}>Deactiveer</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={bulkDelete}>Verwijder</Button>
          </>
        )}
        <Button variant="ghost" size="icon" onClick={fetchSources} disabled={loading} className="h-7 w-7 ml-auto">
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
        </Button>
      </div>

      {/* Grouped collapsible sources */}
      {loading ? (
        <div className="text-xs text-muted-foreground py-4 text-center">Laden...</div>
      ) : filtered.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center border border-dashed rounded-lg">
          <Globe className="h-6 w-6 mx-auto mb-1 opacity-30" />
          Geen bronnen gevonden.
        </div>
      ) : (
        <div className="space-y-1.5">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => {
            const open = isOpen(cat);
            return (
              <div key={cat} className="border border-border rounded-lg overflow-hidden bg-card">
                <button onClick={() => toggleCat(cat)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-muted/50 text-left">
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
                  <span className="text-xs font-semibold uppercase tracking-wide">{cat}</span>
                  <Badge variant="outline" className="text-[10px] h-4 ml-auto">{items.length}</Badge>
                  <span className="text-[10px] text-muted-foreground">{items.filter(i => i.active).length} actief</span>
                </button>
                {open && (
                  <div className="divide-y divide-border/50">
                    {items.map(source => (
                      <div key={source.id}
                        className={cn("flex items-center gap-2 px-2.5 py-1.5 text-xs",
                          !source.active && "opacity-50")}>
                        <Checkbox
                          checked={selected.has(source.id)}
                          onCheckedChange={(c) => setSelected(prev => {
                            const n = new Set(prev);
                            if (c) n.add(source.id); else n.delete(source.id);
                            return n;
                          })}
                          className="h-3.5 w-3.5"
                        />
                        <Switch checked={source.active} onCheckedChange={c => handleToggle(source.id, c)} className="scale-75" />
                        <span className="font-medium min-w-0 truncate w-32">{source.label}</span>
                        <a href={source.url} target="_blank" rel="noreferrer"
                          className="flex-1 text-muted-foreground truncate hover:text-primary inline-flex items-center gap-1 min-w-0">
                          <span className="truncate">{source.url.replace(/^https?:\/\//, '')}</span>
                          <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
                        </a>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => handleDelete(source.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
