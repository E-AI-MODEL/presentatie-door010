import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion, useMotionValue } from "framer-motion";
import { ChevronDown, Globe, Minimize2, Send, Trash2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { notifyProfileUpdated, useLiveProfile } from "@/hooks/useLiveProfile";
import { CollapsibleAnswer } from "@/components/chat/CollapsibleAnswer";
import { ChatTurnArtifacts } from "@/components/chat/ChatTurnArtifacts";
import { TopicMenu } from "@/components/dashboard/TopicMenu";
import { parseStructuredMeta } from "@/utils/responsePipeline";
import type { StructuredResponse } from "@/utils/responsePipeline";
import { sanitizeClientText } from "@/utils/sanitizeClient";
import { normalizeTurnArtifacts } from "@/utils/chatTurnArtifacts";
import type { ChatDecisionArtifact, ChatTurnArtifact } from "@/utils/chatTurnArtifacts";
import type { OrientationPhase } from "@/data/dashboard-phases";
import type { KnownSlots } from "@/utils/phaseDetectorParser";

const DOORAI_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/doorai-chat`;
const HOMEPAGE_COACH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homepage-coach`;

type ChatMode = "personal" | "general";
type Role = "user" | "assistant" | "advisor";

interface ChatMessage {
  role: Role;
  content: string;
  structured?: StructuredResponse | null;
  artifacts?: ChatTurnArtifact[];
}

interface Profile {
  current_phase: string | null;
  preferred_sector: string | null;
  first_name?: string | null;
  bio?: string | null;
  test_completed?: boolean | null;
  test_results?: unknown;
  known_slots?: unknown;
}

const welcomeArtifacts = () => normalizeTurnArtifacts({
  primary_followup: {
    label: "Wat past bij mij?",
    value: "Kun je me helpen bepalen welke route naar het onderwijs bij mij past?",
  },
});

const retryArtifacts = (userMessage: string) => normalizeTurnArtifacts({
  user_message: userMessage,
  primary_followup: { label: "Probeer opnieuw", value: "Kun je dat nog eens uitleggen?" },
});

const fallbackArtifacts = (userMessage: string) => normalizeTurnArtifacts({
  user_message: userMessage,
  primary_followup: {
    label: "Help me kiezen",
    value: "Kun je mijn opties rustig naast elkaar zetten en helpen bepalen wat logisch is?",
  },
});

function metaToArtifacts(payload: unknown, userMessage: string): Partial<ChatMessage> {
  if (!payload || typeof payload !== "object") return {};
  const parsed = payload as Record<string, unknown>;
  if (Array.isArray(parsed.artifacts)) return { artifacts: parsed.artifacts as ChatTurnArtifact[] };

  const source = parsed.meta && typeof parsed.meta === "object" ? parsed.meta as Record<string, unknown> : parsed;
  const structured = parseStructuredMeta(source);
  const artifacts = normalizeTurnArtifacts({
    user_message: userMessage,
    actions: Array.isArray(source.actions) ? source.actions as Array<{ label?: string; value?: string; href?: string }> : undefined,
    links: Array.isArray(source.links) ? source.links as Array<{ label?: string; href?: string }> : undefined,
    verified_links: Array.isArray(source.verified_links)
      ? source.verified_links as Array<{ label?: string; href?: string }>
      : structured?.verifiedLinks,
    primary_followup: structured?.primary_followup,
    phase_suggestion: source.phase_suggestion as { from?: string; to?: string; message?: string; acceptMessage?: string } | undefined,
    confidence: typeof source.confidence === "number" ? source.confidence : undefined,
    reflection_issues: Array.isArray(source.issues) ? source.issues as string[] : undefined,
    include_status: true,
  });
  return { structured, artifacts };
}

export function AuthenticatedChatOverlayV3() {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>("personal");
  const [input, setInput] = useState("");
  const { profile, refresh: refreshProfile } = useLiveProfile<Profile>(
    user?.id,
    "current_phase, preferred_sector, first_name, bio, test_completed, test_results, known_slots",
  );
  const profileRef = useRef<Profile | null>(null);
  profileRef.current = profile;
  const [personalMessages, setPersonalMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Fijn dat je er bent. Waar wil je vandaag mee verder?", artifacts: welcomeArtifacts() },
  ]);
  const [generalMessages, setGeneralMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hoi! Ik ben DoorAI, de wegwijzer van Onderwijsloket Rotterdam. Hoe kan ik je helpen?", artifacts: welcomeArtifacts() },
  ]);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [generalLoading, setGeneralLoading] = useState(false);
  // Topic-burgermenu — default open in persoonlijke chat (per project-memory).
  // Sessie-persistent zodat hij niet steeds terugkomt na sluiten.
  const [topicsOpen, setTopicsOpen] = useState<boolean>(() => {
    try {
      const stored = sessionStorage.getItem("doorai-topics-open");
      return stored === null ? true : stored === "1";
    } catch {
      return true;
    }
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const wasDraggedRef = useRef(false);

  const [launcherMinimized, setLauncherMinimized] = useState(() => {
    try { return localStorage.getItem("doorai-launcher-min") === "1"; } catch { return false; }
  });
  const savedPos = useMemo(() => {
    try {
      const raw = localStorage.getItem("doorai-launcher-pos");
      return raw ? JSON.parse(raw) : { x: 0, y: 0 };
    } catch { return { x: 0, y: 0 }; }
  }, []);
  const launcherX = useMotionValue(savedPos.x);
  const launcherY = useMotionValue(savedPos.y);

  const isBackoffice = location.pathname.startsWith("/backoffice");
  const isPersonal = chatMode === "personal";
  const messages = isPersonal ? personalMessages : generalMessages;
  const loading = isPersonal ? personalLoading : generalLoading;
  const visibleMessages = messages.slice(-10);
  const showTopics = isPersonal && topicsOpen;

  const knownSlots: KnownSlots = useMemo(() => {
    const raw = profile?.known_slots;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  }, [profile?.known_slots]);

  const currentPhaseSafe: OrientationPhase = (profile?.current_phase as OrientationPhase) || "interesseren";

  const toggleTopics = useCallback(() => {
    setTopicsOpen((v) => {
      const next = !v;
      try { sessionStorage.setItem("doorai-topics-open", next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 120);
  }, [isOpen, chatMode]);

  const patchLastAssistant = useCallback((mode: ChatMode, patch: Partial<ChatMessage>) => {
    const setter = mode === "personal" ? setPersonalMessages : setGeneralMessages;
    setter((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.role === "assistant") next[next.length - 1] = { ...last, ...patch };
      return next;
    });
  }, []);

  const readStream = useCallback(async (response: Response, userMessage: string, mode: ChatMode) => {
    if (!response.body) throw new Error("Missing response body");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let eventType = "";
    let content = "";
    let hasArtifacts = false;
    let doneSeen = false;

    // Lees door tot reader echt klaar is; server stuurt meta-events (ui/reflection)
    // ná [DONE], die we anders missen waardoor de chip-fallback ten onrechte triggert.
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);

        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
          continue;
        }
        if (line.trim() === "" || line.startsWith(":")) {
          if (line.trim() === "") eventType = "";
          continue;
        }
        if (!line.startsWith("data: ")) continue;

        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          doneSeen = true;
          continue;
        }

        try {
          const parsed = JSON.parse(data);
          const isMeta = eventType === "turn_meta" || eventType === "ui" || eventType === "reflection" || parsed.meta || parsed.actions || parsed.links || parsed.artifacts;
          if (isMeta) {
            const patch = metaToArtifacts(parsed, userMessage);
            if (patch.artifacts && patch.artifacts.length > 0) hasArtifacts = true;
            if (patch.artifacts || patch.structured) patchLastAssistant(mode, patch);
            eventType = "";
            continue;
          }

          const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (delta) {
            content += delta;
            patchLastAssistant(mode, { content });
          }
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }

    return { text: sanitizeClientText(content), hasArtifacts };
  }, [patchLastAssistant]);

  const sendMessage = useCallback(async (text: string, mode: ChatMode = chatMode) => {
    if (!text.trim()) return;
    if (mode === "personal" && personalLoading) return;
    if (mode === "general" && generalLoading) return;

    const setMessages = mode === "personal" ? setPersonalMessages : setGeneralMessages;
    const setLoading = mode === "personal" ? setPersonalLoading : setGeneralLoading;
    const previous = mode === "personal" ? personalMessages : generalMessages;
    const url = mode === "personal" ? DOORAI_URL : HOMEPAGE_COACH_URL;
    const userMessage: ChatMessage = { role: "user", content: text };

    setMessages((prev) => [...prev.map((m) => m.role === "assistant" ? { ...m, artifacts: [] } : m), userMessage, { role: "assistant", content: "", artifacts: [] }]);
    setInput("");
    setLoading(true);

    try {
      // Echte user-JWT meegeven zodat server-side verse profile fetch werkt
      // (anon/publishable key matcht geen user → server zou stil terugvallen).
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken =
        sessionData.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const currentProfile = profileRef.current;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: [...previous, userMessage].slice(-12).map((m) => ({ role: m.role, content: m.content })),
          mode: mode === "personal" ? "authenticated" : "public",
          // userPhase/userSector bewust weggelaten: server doet verse DB-fetch.
          profileMeta: currentProfile || undefined,
        }),
      });
      if (!response.ok) {
        let detail = "";
        try {
          const errBody = await response.json();
          detail = typeof errBody?.error === "string" ? errBody.error : "";
        } catch { /* non-json body */ }
        throw new Error(detail || `Failed to get response (${response.status})`);
      }
      const result = await readStream(response, text, mode);
      patchLastAssistant(mode, result.hasArtifacts ? { content: result.text } : { content: result.text, artifacts: fallbackArtifacts(text) });
    } catch (error) {
      console.error("Chat error:", error);
      const msg = error instanceof Error && error.message && !error.message.startsWith("Failed to get response")
        ? error.message
        : "Sorry, er ging iets mis. Probeer het later opnieuw.";
      patchLastAssistant(mode, { content: msg, artifacts: retryArtifacts(text) });
    } finally {
      setLoading(false);
    }
  }, [chatMode, generalLoading, generalMessages, patchLastAssistant, personalLoading, personalMessages, readStream]);

  const handleDecisionAccept = useCallback(async (artifact: ChatDecisionArtifact) => {
    if (user && artifact.to) {
      await supabase
        .from("profiles")
        .update({ current_phase: artifact.to as "beslissen" | "interesseren" | "matchen" | "orienteren" | "voorbereiden" })
        .eq("user_id", user.id);
      notifyProfileUpdated();
      // Verse fetch afwachten zodat profileRef de nieuwe fase bevat
      // vóór de volgende sendMessage; voorkomt stale-phase race.
      await refreshProfile();
    }
    await sendMessage(artifact.acceptValue, chatMode);
  }, [chatMode, refreshProfile, sendMessage, user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input, chatMode);
  };

  const clearCurrent = () => {
    if (isPersonal) {
      setPersonalMessages([{ role: "assistant", content: "Fijn dat je er weer bent. Waar wil je vandaag mee verder?", artifacts: welcomeArtifacts() }]);
    } else {
      setGeneralMessages([{ role: "assistant", content: "Hoi! Ik ben DoorAI, de wegwijzer van Onderwijsloket Rotterdam. Hoe kan ik je helpen?", artifacts: welcomeArtifacts() }]);
    }
  };

  if (!user || isBackoffice) return null;

  const firstInitial = (profile?.first_name?.trim()?.[0] || user.email?.[0] || "?").toUpperCase();

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            key={launcherMinimized ? "min" : "full"}
            style={{ x: launcherX, y: launcherY, position: "fixed", bottom: 24, right: 24, zIndex: 50 }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            drag
            dragMomentum={false}
            onDragStart={() => { wasDraggedRef.current = false; }}
            onDrag={() => { wasDraggedRef.current = true; }}
            onDragEnd={() => {
              try { localStorage.setItem("doorai-launcher-pos", JSON.stringify({ x: launcherX.get(), y: launcherY.get() })); } catch {}
            }}
            onClick={() => {
              if (wasDraggedRef.current) { wasDraggedRef.current = false; return; }
              if (launcherMinimized) {
                setLauncherMinimized(false);
                try { localStorage.setItem("doorai-launcher-min", "0"); } catch {}
              }
              setIsOpen(true);
            }}
            className="group select-none cursor-grab active:cursor-grabbing"
            aria-label={launcherMinimized ? "Open DoorAI coach" : "Open jouw persoonlijke DoorAI coach"}
          >
            {launcherMinimized ? (
              <span className="relative flex items-center justify-center h-9 w-9 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-lg shadow-primary/20 border-2 border-primary/30">
                {firstInitial}
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-card" aria-hidden />
              </span>
            ) : (
              <span className="flex items-center gap-2 rounded-full bg-card border border-border/70 pl-1 pr-2.5 py-1 shadow-lg shadow-primary/10 hover:shadow-xl hover:shadow-primary/15 transition-shadow">
                <span className="relative h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                  {firstInitial}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 border-2 border-card" aria-hidden />
                </span>
                <span className="flex flex-col items-start text-left leading-tight">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Jouw coach</span>
                  <span className="text-sm font-bold text-foreground">DoorAI</span>
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setLauncherMinimized(true);
                    try { localStorage.setItem("doorai-launcher-min", "1"); } catch {}
                  }}
                  className="ml-0.5 p-1 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                  aria-label="Minimaliseer launcher"
                  title="Minimaliseer"
                >
                  <Minimize2 className="h-3 w-3" />
                </span>
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} className="fixed z-50 bg-card border border-border overflow-hidden flex flex-col bottom-6 right-6 rounded-3xl shadow-2xl w-[min(420px,calc(100vw-3rem))] h-[min(620px,calc(100vh-6rem))]" role="dialog" aria-modal="true" aria-label="DOORai chat">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold shrink-0">
                  {isPersonal ? firstInitial : <Globe className="h-3.5 w-3.5" />}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 border-2 border-card" />
                </span>
                <div className="flex flex-col leading-tight min-w-0">
                  <span className="text-sm font-bold text-foreground truncate">DoorAI</span>
                  <span className="text-[10px] text-muted-foreground">{isPersonal ? "Persoonlijk" : "Algemeen"}</span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => setChatMode("personal")}
                  className={`p-1.5 rounded-md transition-colors ${isPersonal ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                  title="Persoonlijk"
                  aria-label="Persoonlijk"
                >
                  <User className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setChatMode("general")}
                  className={`p-1.5 rounded-md transition-colors ${!isPersonal ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                  title="Algemeen"
                  aria-label="Algemeen"
                >
                  <Globe className="h-3.5 w-3.5" />
                </button>
                <div className="w-px h-4 bg-border mx-0.5" />
                {isPersonal && (
                  <button
                    onClick={toggleTopics}
                    className={`p-1.5 rounded-md transition-colors ${showTopics ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                    aria-label={showTopics ? "Sluit onderwerpen" : "Bekijk onderwerpen"}
                    aria-expanded={showTopics}
                    title="Onderwerpen"
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showTopics ? "" : "-rotate-90"}`} />
                  </button>
                )}
                {messages.length > 1 && (
                  <button onClick={clearCurrent} className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-destructive" aria-label="Gesprek wissen" title="Wissen">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground" aria-label="Sluit chat" title="Sluiten">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>


            {/* Topic-paneel — vervangt berichten zolang open (overlay is compact) */}
            {showTopics ? (
              <div className="flex-1 overflow-y-auto bg-card">
                <div className="px-4 py-2 flex items-center justify-between border-b border-border/60 sticky top-0 bg-card/95 backdrop-blur z-10">
                  <span className="text-[12px] font-semibold text-foreground">Waar wil je over praten?</span>
                  <button
                    onClick={toggleTopics}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium px-2 py-1 rounded-full transition-colors"
                    aria-label="Sluit onderwerpen"
                  >
                    <X className="h-3 w-3" />
                    Sluit
                  </button>
                </div>
                <TopicMenu
                  variant="compact"
                  currentPhase={currentPhaseSafe}
                  knownSlots={knownSlots}
                  onSendMessage={(msg) => {
                    setTopicsOpen(false);
                    try { sessionStorage.setItem("doorai-topics-open", "0"); } catch { /* noop */ }
                    sendMessage(msg, "personal");
                  }}
                />
              </div>


            ) : (
              <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5" aria-live="polite">
                {(() => {
                  const lastAssistantIdx = (() => {
                    for (let i = visibleMessages.length - 1; i >= 0; i--) {
                      if (visibleMessages[i].role === "assistant") return i;
                    }
                    return -1;
                  })();
                  return visibleMessages.map((message, index) => {
                    const isLastAssistant = index === lastAssistantIdx;
                    let assistantTint = "bg-muted text-foreground";
                    if (isLastAssistant) {
                      const statusArtifact = message.artifacts?.find((a) => a.kind === "status") as { confidence?: number } | undefined;
                      const conf = statusArtifact?.confidence;
                      if (typeof conf === "number") {
                        if (conf < 0.55) assistantTint = "bg-amber-50 dark:bg-amber-950/20 text-foreground";
                        else if (conf < 0.75) assistantTint = "bg-emerald-50 dark:bg-emerald-950/20 text-foreground";
                      }
                    }
                    return (
                      <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${message.role === "user" ? "bg-primary text-primary-foreground" : message.role === "advisor" ? "bg-accent/15 border border-accent/30 text-foreground" : assistantTint}`}>
                          {message.role === "user" ? <p className="text-[13px]">{message.content}</p> : (
                            <>
                              {message.role === "advisor" && <span className="text-[10px] font-semibold text-accent-foreground uppercase tracking-wide mb-1 block">Adviseur</span>}
                              <CollapsibleAnswer content={message.content} structured={message.structured} compact />
                              <ChatTurnArtifacts artifacts={message.artifacts} onAsk={(value) => sendMessage(value, chatMode)} onDecisionAccept={handleDecisionAccept} onDecisionDecline={() => undefined} disabled={loading} compact />
                            </>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
                {loading && messages[messages.length - 1]?.role === "user" && <div className="flex justify-start"><div className="bg-muted rounded-2xl px-3.5 py-2.5"><div className="flex gap-1"><span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" /><span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} /><span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} /></div></div></div>}
              </div>
            )}

            <div className="px-4 pb-3 pt-2 border-t border-border shrink-0">
              <form onSubmit={handleSubmit} className="flex gap-2 items-center">
                <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={isPersonal ? "Stel je vraag..." : "Vraag over onderwijs..."} disabled={loading} className="flex-1 h-9 text-sm rounded-xl" aria-label="Stel je vraag" />
                <Button type="submit" size="sm" disabled={loading || !input.trim()} className="h-9 w-9 p-0 rounded-xl" aria-label="Verstuur bericht"><Send className="h-3.5 w-3.5" /></Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
