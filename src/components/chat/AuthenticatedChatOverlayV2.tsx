import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Globe, Maximize2, MessageCircle, Minimize2, Send, Square, Trash2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { notifyProfileUpdated } from "@/hooks/useLiveProfile";
import { CollapsibleAnswer } from "@/components/chat/CollapsibleAnswer";
import { ChatTurnArtifacts } from "@/components/chat/ChatTurnArtifacts";
import { parseStructuredMeta } from "@/utils/responsePipeline";
import type { StructuredResponse } from "@/utils/responsePipeline";
import { sanitizeClientText } from "@/utils/sanitizeClient";
import { normalizeTurnArtifacts } from "@/utils/chatTurnArtifacts";
import type { ChatDecisionArtifact, ChatTurnArtifact } from "@/utils/chatTurnArtifacts";

const DOORAI_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/doorai-chat`;
const HOMEPAGE_COACH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homepage-coach`;

type ChatMode = "personal" | "general";
type WidgetSize = "compact" | "expanded" | "fullscreen";

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

function welcomeArtifacts(): ChatTurnArtifact[] {
  return normalizeTurnArtifacts({
    primary_followup: {
      label: "Wat past bij mij?",
      value: "Kun je me helpen bepalen welke route naar het onderwijs bij mij past?",
    },
  });
}

function fallbackArtifacts(userMessage: string): ChatTurnArtifact[] {
  return normalizeTurnArtifacts({
    user_message: userMessage,
    primary_followup: {
      label: "Help me kiezen",
      value: "Kun je mijn opties rustig naast elkaar zetten en helpen bepalen wat logisch is?",
    },
  });
}

function parseArtifactsFromPayload(payload: unknown, userMessage: string): { structured?: StructuredResponse | null; artifacts: ChatTurnArtifact[] } {
  if (!payload || typeof payload !== "object") return { artifacts: [] };
  const parsed = payload as Record<string, unknown>;

  if (Array.isArray(parsed.artifacts)) {
    return { artifacts: parsed.artifacts as ChatTurnArtifact[] };
  }

  const metaSource = parsed.meta && typeof parsed.meta === "object" ? parsed.meta as Record<string, unknown> : parsed;
  const structured = parseStructuredMeta(metaSource);

  return {
    structured,
    artifacts: normalizeTurnArtifacts({
      user_message: userMessage,
      actions: Array.isArray(metaSource.actions) ? metaSource.actions as Array<{ label?: string; value?: string; href?: string }> : undefined,
      links: Array.isArray(metaSource.links) ? metaSource.links as Array<{ label?: string; href?: string }> : undefined,
      verified_links: Array.isArray(metaSource.verified_links)
        ? metaSource.verified_links as Array<{ label?: string; href?: string }>
        : structured?.verifiedLinks,
      primary_followup: structured?.primary_followup,
      phase_suggestion: metaSource.phase_suggestion as {
        from?: string;
        to?: string;
        message?: string;
        acceptMessage?: string;
      } | undefined,
      confidence: typeof metaSource.confidence === "number" ? metaSource.confidence : undefined,
      reflection_issues: Array.isArray(metaSource.issues) ? metaSource.issues as string[] : undefined,
      include_status: true,
    }),
  };
}

async function readAssistantStream(opts: {
  response: Response;
  userMessage: string;
  onDelta: (content: string) => void;
  onMeta: (patch: Partial<ChatMessage>) => void;
}): Promise<string> {
  if (!opts.response.body) throw new Error("Missing response body");

  const reader = opts.response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEventType = "";
  let assistantContent = "";
  let doneSeen = false;

  while (!doneSeen) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);

      if (line.startsWith("event: ")) {
        currentEventType = line.slice(7).trim();
        continue;
      }
      if (line.startsWith(":") || line.trim() === "") {
        if (line.trim() === "") currentEventType = "";
        continue;
      }
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        doneSeen = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);

        if (currentEventType === "turn_meta" || currentEventType === "ui" || parsed.meta || parsed.actions || parsed.links || parsed.artifacts) {
          const meta = parseArtifactsFromPayload(parsed, opts.userMessage);
          if (meta.artifacts.length > 0 || meta.structured) {
            opts.onMeta({ structured: meta.structured, artifacts: meta.artifacts });
          }
          currentEventType = "";
          continue;
        }

        if (currentEventType === "reflection") {
          const meta = parseArtifactsFromPayload(
            { confidence: parsed.confidence, issues: parsed.issues },
            opts.userMessage,
          );
          if (meta.artifacts.length > 0) opts.onMeta({ artifacts: meta.artifacts });
          currentEventType = "";
          continue;
        }

        const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (delta) {
          assistantContent += delta;
          opts.onDelta(assistantContent);
        }
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  return sanitizeClientText(assistantContent);
}

export function AuthenticatedChatOverlayV2() {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [widgetSize, setWidgetSize] = useState<WidgetSize>("compact");
  const [chatMode, setChatMode] = useState<ChatMode>("personal");
  const [input, setInput] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [personalMessages, setPersonalMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Fijn dat je er bent. Waar wil je vandaag mee verder?", artifacts: welcomeArtifacts() },
  ]);
  const [generalMessages, setGeneralMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hoi! Ik ben DoorAI, de wegwijzer van Onderwijsloket Rotterdam. Hoe kan ik je helpen?", artifacts: welcomeArtifacts() },
  ]);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [generalLoading, setGeneralLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const isBackoffice = location.pathname.startsWith("/backoffice");
  const isPersonal = chatMode === "personal";
  const currentMessages = isPersonal ? personalMessages : generalMessages;
  const currentLoading = isPersonal ? personalLoading : generalLoading;
  const visibleMessages = currentMessages.slice(-10);

  const sizeStyles = useMemo(() => {
    if (widgetSize === "fullscreen") return { width: "100vw", height: "100vh" };
    if (widgetSize === "expanded") return { width: "min(520px, calc(100vw - 3rem))", height: "min(720px, calc(100vh - 6rem))" };
    return { width: "min(380px, calc(100vw - 3rem))", height: "min(500px, calc(100vh - 6rem))" };
  }, [widgetSize]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("current_phase, preferred_sector, first_name, bio, test_completed, test_results, known_slots")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data);
      });
  }, [user]);

  useEffect(() => {
    chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
  }, [currentMessages, currentLoading]);

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

  const sendMessage = useCallback(async (text: string, mode: ChatMode = chatMode) => {
    if (!text.trim()) return;
    if (mode === "personal" && personalLoading) return;
    if (mode === "general" && generalLoading) return;

    const setMessages = mode === "personal" ? setPersonalMessages : setGeneralMessages;
    const setLoading = mode === "personal" ? setPersonalLoading : setGeneralLoading;
    const url = mode === "personal" ? DOORAI_URL : HOMEPAGE_COACH_URL;
    const previous = mode === "personal" ? personalMessages : generalMessages;
    const userMessage: ChatMessage = { role: "user", content: text };

    setMessages((prev) => [...prev.map((m) => m.role === "assistant" ? { ...m, artifacts: [] } : m), userMessage, { role: "assistant", content: "", artifacts: [] }]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...previous, userMessage].slice(-12).map((m) => ({ role: m.role, content: m.content })),
          mode: mode === "personal" ? "authenticated" : "public",
          userPhase: profile?.current_phase || "interesseren",
          userSector: profile?.preferred_sector,
          profileContext: profile || undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      let receivedArtifacts = false;
      const finalText = await readAssistantStream({
        response,
        userMessage: text,
        onDelta: (content) => patchLastAssistant(mode, { content }),
        onMeta: (patch) => {
          if (patch.artifacts && patch.artifacts.length > 0) receivedArtifacts = true;
          patchLastAssistant(mode, patch);
        },
      });

      patchLastAssistant(mode, {
        content: finalText,
        artifacts: receivedArtifacts ? undefined : fallbackArtifacts(text),
      });
    } catch (error) {
      console.error("Chat error:", error);
      patchLastAssistant(mode, {
        content: "Sorry, er ging iets mis. Probeer het later opnieuw.",
        artifacts: normalizeTurnArtifacts({
          user_message: text,
          primary_followup: { label: "Probeer opnieuw", value: "Kun je dat nog eens uitleggen?" },
        }),
      });
    } finally {
      setLoading(false);
    }
  }, [chatMode, generalLoading, generalMessages, patchLastAssistant, personalLoading, personalMessages, profile]);

  const handleDecisionAccept = useCallback(async (artifact: ChatDecisionArtifact) => {
    if (user && artifact.to) {
      const { data } = await supabase
        .from("profiles")
        .update({ current_phase: artifact.to })
        .eq("user_id", user.id)
        .select("current_phase, preferred_sector, first_name, bio, test_completed, test_results, known_slots")
        .single();
      if (data) setProfile(data);
      notifyProfileUpdated();
    }
    await sendMessage(artifact.acceptValue, chatMode);
  }, [chatMode, sendMessage, user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input, chatMode);
  };

  const handleClear = () => {
    if (isPersonal) {
      setPersonalMessages([{ role: "assistant", content: "Fijn dat je er weer bent. Waar wil je vandaag mee verder?", artifacts: welcomeArtifacts() }]);
    } else {
      setGeneralMessages([{ role: "assistant", content: "Hoi! Ik ben DoorAI, de wegwijzer van Onderwijsloket Rotterdam. Hoe kan ik je helpen?", artifacts: welcomeArtifacts() }]);
    }
  };

  const cycleSize = () => setWidgetSize(prev => prev === "compact" ? "expanded" : prev === "expanded" ? "fullscreen" : "compact");

  if (!user || isBackoffice) return null;

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 bg-primary text-primary-foreground rounded-full p-4 shadow-lg hover:bg-primary/90 transition-colors"
            aria-label="Open DOORai chat"
          >
            <MessageCircle className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed z-50 bg-card border border-border overflow-hidden flex flex-col ${widgetSize === "fullscreen" ? "inset-0" : "bottom-6 right-6 rounded-3xl shadow-2xl"}`}
            style={widgetSize === "fullscreen" ? {} : sizeStyles}
            role="dialog"
            aria-modal="true"
            aria-label="DOORai chat"
          >
            <div className="flex flex-col border-b border-border shrink-0">
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <h3 className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">DOORai</h3>
                </div>
                <div className="flex items-center gap-0.5">
                  {currentMessages.length > 1 && (
                    <button onClick={handleClear} className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-destructive" aria-label="Gesprek wissen">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={cycleSize} className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground" aria-label={widgetSize === "fullscreen" ? "Verklein" : "Vergroot"}>
                    {widgetSize === "fullscreen" ? <Minimize2 className="h-3.5 w-3.5" /> : widgetSize === "expanded" ? <Square className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground" aria-label="Sluit chat">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1 px-4 pb-2">
                <button onClick={() => setChatMode("personal")} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${isPersonal ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                  <User className="h-3 w-3" /> Persoonlijk
                </button>
                <button onClick={() => setChatMode("general")} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${!isPersonal ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                  <Globe className="h-3 w-3" /> Algemeen
                </button>
              </div>
            </div>

            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5" aria-live="polite">
              {visibleMessages.map((message, index) => (
                <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${message.role === "user" ? "bg-primary text-primary-foreground" : message.role === "advisor" ? "bg-accent/15 border border-accent/30 text-foreground" : "bg-muted text-foreground"}`}>
                    {message.role === "advisor" && <span className="text-[10px] font-semibold text-accent-foreground uppercase tracking-wide mb-1 block">Adviseur</span>}
                    {message.role === "user" ? (
                      <p className="text-[13px]">{message.content}</p>
                    ) : (
                      <>
                        <CollapsibleAnswer content={message.content} structured={message.structured} compact />
                        <ChatTurnArtifacts
                          artifacts={message.artifacts}
                          onAsk={(value) => sendMessage(value, chatMode)}
                          onDecisionAccept={handleDecisionAccept}
                          onDecisionDecline={() => undefined}
                          disabled={currentLoading}
                          compact
                        />
                      </>
                    )}
                  </div>
                </div>
              ))}
              {currentLoading && currentMessages[currentMessages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-3.5 py-2.5">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 pb-3 pt-2 border-t border-border shrink-0">
              <form onSubmit={handleSubmit} className="flex gap-2 items-center">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isPersonal ? "Stel je vraag..." : "Vraag over onderwijs..."}
                  disabled={currentLoading}
                  className="flex-1 h-9 text-sm rounded-xl"
                  aria-label="Stel je vraag"
                />
                <Button type="submit" size="sm" disabled={currentLoading || !input.trim()} className="h-9 w-9 p-0 rounded-xl" aria-label="Verstuur bericht">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
