import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Save, Wrench, AlertTriangle, Bot, Plus, Trash2, CheckCircle2, CircleDot, Library } from "lucide-react";
import { toast } from "sonner";

type PromptConfig = {
  id: string;
  chatbot_key: string;
  title: string;
  addon_label: string;
  prompt_override: string | null;
  active: boolean;
  notes: string | null;
  sort_order: number;
  updated_at: string;
};

type PipelineEvent = {
  id: string;
  chatbot_key: string;
  stage: string;
  severity: "info" | "warning" | "error";
  message: string;
  created_at: string;
  resolved: boolean;
};

const CHATBOT_KEYS = ["homepage-coach", "doorai-chat"];

function severityBadgeVariant(severity: PipelineEvent["severity"]) {
  if (severity === "error") return "destructive" as const;
  if (severity === "warning") return "secondary" as const;
  return "outline" as const;
}

// ── Add-on Card ────────────────────────────────────────────────
function AddonCard({
  config,
  onSave,
  onDelete,
  onToggle,
  saving,
}: {
  config: PromptConfig;
  onSave: (id: string, override: string, notes: string, label: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState(config.prompt_override ?? "");
  const [notesDraft, setNotesDraft] = useState(config.notes ?? "");
  const [labelDraft, setLabelDraft] = useState(config.addon_label ?? "");

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${config.active ? "bg-card border-primary/30" : "bg-muted/30 border-border"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Switch
            checked={config.active}
            onCheckedChange={(checked) => onToggle(config.id, checked)}
          />
          <Input
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            placeholder="Add-on label"
            className="h-7 text-xs max-w-[200px]"
          />
          <Badge variant={config.active ? "default" : "secondary"} className="shrink-0 text-[10px]">
            {config.active ? "Actief" : "Uit"}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onDelete(config.id)} className="text-destructive h-7 w-7 p-0">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Prompt add-on tekst (wordt toegevoegd aan de basisprompt)"
        className="min-h-28 text-xs"
      />

      <Textarea
        value={notesDraft}
        onChange={(e) => setNotesDraft(e.target.value)}
        placeholder="Notities / tuning rationale"
        className="min-h-16 text-xs"
      />

      <div className="flex items-center justify-between">
        <Button size="sm" onClick={() => onSave(config.id, draft, notesDraft, labelDraft)} disabled={saving}>
          <Save className="h-3.5 w-3.5 mr-1" />
          Opslaan
        </Button>
        <span className="text-[11px] text-muted-foreground">
          {new Date(config.updated_at).toLocaleString("nl-NL")}
        </span>
      </div>
    </div>
  );
}

// ── Main Tab ───────────────────────────────────────────────────
export function SuperuserControlTab() {
  const [promptConfigs, setPromptConfigs] = useState<PromptConfig[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [pipelineEvents, setPipelineEvents] = useState<PipelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [filterBot, setFilterBot] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("open");

  const loadPromptConfigs = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("llm_prompt_configs")
      .select("id, chatbot_key, title, addon_label, prompt_override, active, notes, sort_order, updated_at")
      .order("chatbot_key", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      toast.error("Kon prompt-instellingen niet laden");
      console.error("Failed to load prompt configs", error);
      return;
    }
    setPromptConfigs((data ?? []) as PromptConfig[]);
  }, []);

  const loadPipelineEvents = useCallback(async () => {
    setLoadingEvents(true);
    const { data, error } = await (supabase as any)
      .from("chatbot_pipeline_events")
      .select("id, chatbot_key, stage, severity, message, created_at, resolved")
      .order("created_at", { ascending: false })
      .limit(80);

    if (error) {
      toast.error("Kon pipeline-events niet laden");
      setLoadingEvents(false);
      return;
    }
    setPipelineEvents((data ?? []) as PipelineEvent[]);
    setLoadingEvents(false);
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadPromptConfigs(), loadPipelineEvents()]);
    setLoading(false);
  }, [loadPromptConfigs, loadPipelineEvents]);

  useEffect(() => { void refreshAll(); }, [refreshAll]);

  const saveAddon = useCallback(async (id: string, override: string, notes: string, label: string) => {
    setSavingId(id);
    const { data: authData } = await supabase.auth.getUser();
    const { error } = await (supabase as any)
      .from("llm_prompt_configs")
      .update({
        prompt_override: override.trim() || null,
        notes: notes.trim() || null,
        addon_label: label.trim(),
        updated_by: authData.user?.id ?? null,
      })
      .eq("id", id);

    if (error) { toast.error("Opslaan mislukt"); setSavingId(null); return; }
    toast.success("Add-on opgeslagen");
    await loadPromptConfigs();
    setSavingId(null);
  }, [loadPromptConfigs]);

  const toggleAddon = useCallback(async (id: string, active: boolean) => {
    const { error } = await (supabase as any)
      .from("llm_prompt_configs")
      .update({ active })
      .eq("id", id);

    if (error) { toast.error("Toggle mislukt"); return; }
    toast.success(active ? "Add-on geactiveerd" : "Add-on gedeactiveerd");
    await loadPromptConfigs();
  }, [loadPromptConfigs]);

  const deleteAddon = useCallback(async (id: string) => {
    const { error } = await (supabase as any)
      .from("llm_prompt_configs")
      .delete()
      .eq("id", id);

    if (error) { toast.error("Verwijderen mislukt"); return; }
    toast.success("Add-on verwijderd");
    await loadPromptConfigs();
  }, [loadPromptConfigs]);

  const addNewAddon = useCallback(async (chatbotKey: string, title: string) => {
    const maxSort = promptConfigs
      .filter((c) => c.chatbot_key === chatbotKey)
      .reduce((max, c) => Math.max(max, c.sort_order), -1);

    const { error } = await (supabase as any)
      .from("llm_prompt_configs")
      .insert({
        chatbot_key: chatbotKey,
        title,
        addon_label: `Add-on ${maxSort + 2}`,
        sort_order: maxSort + 1,
        active: false,
        prompt_override: null,
      });

    if (error) { toast.error("Toevoegen mislukt"); return; }
    toast.success("Nieuwe add-on aangemaakt");
    await loadPromptConfigs();
  }, [promptConfigs, loadPromptConfigs]);

  const toggleResolve = useCallback(async (id: string, resolved: boolean) => {
    const { error } = await (supabase as any)
      .from("chatbot_pipeline_events")
      .update({ resolved })
      .eq("id", id);

    if (error) { toast.error("Status wijzigen mislukt"); return; }
    toast.success(resolved ? "Issue opgelost" : "Issue heropend");
    setPipelineEvents((prev) =>
      prev.map((e) => e.id === id ? { ...e, resolved } : e)
    );
  }, []);

  const filteredEvents = useMemo(() => {
    let result = pipelineEvents;
    if (filterBot !== "all") {
      result = result.filter((e) => e.chatbot_key === filterBot);
    }
    if (filterStatus === "open") {
      result = result.filter((e) => !e.resolved);
    } else if (filterStatus === "resolved") {
      result = result.filter((e) => e.resolved);
    }
    return result;
  }, [filterBot, filterStatus, pipelineEvents]);

  const eventCounts = useMemo(() => ({
    total: pipelineEvents.length,
    errors: pipelineEvents.filter((e) => e.severity === "error").length,
    warnings: pipelineEvents.filter((e) => e.severity === "warning").length,
    unresolved: pipelineEvents.filter((e) => !e.resolved).length,
  }), [pipelineEvents]);

  const groupedConfigs = useMemo(() => {
    const map: Record<string, PromptConfig[]> = {};
    for (const key of CHATBOT_KEYS) map[key] = [];
    for (const c of promptConfigs) {
      if (!map[c.chatbot_key]) map[c.chatbot_key] = [];
      map[c.chatbot_key].push(c);
    }
    return map;
  }, [promptConfigs]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Superuser besturing
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                Beheer prompt add-ons en pipeline-monitoring voor beide chatbots.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading || loadingEvents}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading || loadingEvents ? "animate-spin" : ""}`} />
              Vernieuwen
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Pipeline events</p><p className="text-2xl font-semibold">{eventCounts.total}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Errors</p><p className="text-2xl font-semibold text-destructive">{eventCounts.errors}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Warnings</p><p className="text-2xl font-semibold text-amber-500">{eventCounts.warnings}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Open issues</p><p className="text-2xl font-semibold">{eventCounts.unresolved}</p></CardContent></Card>
      </div>

      {/* Override Bibliotheek */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Library className="h-4 w-4" />
            Override Bibliotheek
          </CardTitle>
          <CardDescription className="text-xs">
            Elke add-on wordt <strong>toegevoegd</strong> aan de basisprompt (niet vervangen). Gebruik de toggle om een add-on aan/uit te zetten zonder deze te verwijderen.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {CHATBOT_KEYS.map((key) => {
          const configs = groupedConfigs[key] ?? [];
          const title = key === "doorai-chat" ? "DoorAI Authenticated Chat" : "DoorAI Public Widget";
          return (
            <Card key={key} className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <Bot className="h-4 w-4" />
                    {title}
                  </span>
                  <Badge variant="outline" className="text-[11px]">{key}</Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  {configs.filter((c) => c.active).length} van {configs.length} add-ons actief
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {configs.length === 0 && (
                  <p className="text-sm text-muted-foreground">Geen add-ons. Klik + om er een toe te voegen.</p>
                )}
                {configs.map((config) => (
                  <AddonCard
                    key={config.id}
                    config={config}
                    onSave={saveAddon}
                    onDelete={deleteAddon}
                    onToggle={toggleAddon}
                    saving={savingId === config.id}
                  />
                ))}
                <Button variant="outline" size="sm" className="w-full" onClick={() => addNewAddon(key, title)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add-on toevoegen
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pipeline Events */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Pipeline fouten & waarschuwingen
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={filterBot} onValueChange={setFilterBot}>
                <SelectTrigger className="h-8 text-xs w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle bots</SelectItem>
                  <SelectItem value="homepage-coach">homepage-coach</SelectItem>
                  <SelectItem value="doorai-chat">doorai-chat</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 text-xs w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="resolved">Opgelost</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={loadPipelineEvents} disabled={loadingEvents}>
                <RefreshCw className={`h-3.5 w-3.5 ${loadingEvents ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && pipelineEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">Laden...</p>
          ) : filteredEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">Geen events gevonden voor dit filter.</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {filteredEvents.map((event) => (
                <div key={event.id} className={`rounded-lg border p-3 ${event.resolved ? "bg-muted/30 opacity-70" : "bg-card"}`}>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant={severityBadgeVariant(event.severity)} className="capitalize">{event.severity}</Badge>
                    <Badge variant="outline">{event.chatbot_key}</Badge>
                    <span className="text-[11px] text-muted-foreground">{event.stage}</span>
                    <div className="ml-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 px-2 text-[11px] gap-1 ${event.resolved ? "text-muted-foreground" : "text-primary"}`}
                        onClick={() => toggleResolve(event.id, !event.resolved)}
                      >
                        {event.resolved ? (
                          <><CheckCircle2 className="h-3 w-3" /> Opgelost</>
                        ) : (
                          <><CircleDot className="h-3 w-3" /> Markeer opgelost</>
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm">{event.message}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{new Date(event.created_at).toLocaleString("nl-NL")}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
