import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Snapshot {
  confidence: number;
  evidence: string[];
  phase_current_ui: string;
  exit_criteria_met?: boolean;
  uncertain?: boolean;
  ts: string;
  last_user_msg?: string;
}

interface Row {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  current_phase: string | null;
  last_detector_snapshot: Snapshot | null;
}



export function DetectorDebugTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, current_phase, last_detector_snapshot" as string)
      .order("updated_at", { ascending: false })
      .limit(50);
    setRows((data || []) as unknown as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("detector-debug")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const withSnapshot = rows.filter((r) => r.last_detector_snapshot);
  const uncertain = withSnapshot.filter((r) => r.last_detector_snapshot!.uncertain);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base md:text-lg">DoorAI gespreksanalyse — live</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Toont per gebruiker de laatste zekerheid (confidence) en herkende signalen van de gespreksanalyse. Updates real-time.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          {withSnapshot.length} gesprekken · {uncertain.length} met twijfel
        </div>

        {withSnapshot.length === 0 && (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Nog geen analyses geregistreerd. Start een chat als kandidaat om data te zien verschijnen.
          </div>
        )}

        <div className="space-y-2">
          {withSnapshot.map((r) => {
            const s = r.last_detector_snapshot!;
            const name = [r.first_name, r.last_name].filter(Boolean).join(" ") || "Onbekend";
            const time = new Date(s.ts).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });
            return (
              <div key={r.user_id} className="border rounded-xl p-3 space-y-2 bg-card">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm truncate">{name}</span>
                    <Badge variant="outline" className="text-[10px]">{s.phase_current_ui}</Badge>
                    {s.uncertain && (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        twijfel · {(s.confidence * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{time}</span>
                </div>



                {s.last_user_msg && (
                  <div className="text-xs italic text-muted-foreground bg-muted/40 rounded-lg px-2 py-1 truncate">
                    "{s.last_user_msg}"
                  </div>
                )}

                {s.evidence && s.evidence.length > 0 && (
                  <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc list-inside">
                    {s.evidence.slice(0, 5).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
