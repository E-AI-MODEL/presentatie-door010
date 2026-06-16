import { useEffect, useRef, useState } from "react";
import { Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { CollapsibleAnswer } from "@/components/chat/CollapsibleAnswer";
import { ChatTurnArtifacts } from "@/components/chat/ChatTurnArtifacts";
import { parseStructuredMeta } from "@/utils/responsePipeline";
import type { StructuredResponse } from "@/utils/responsePipeline";
import { sanitizeClientText } from "@/utils/sanitizeClient";
import { normalizeTurnArtifacts } from "@/utils/chatTurnArtifacts";
import type { ChatTurnArtifact } from "@/utils/chatTurnArtifacts";

interface Message {
  role: "user" | "assistant";
  content: string;
  structured?: StructuredResponse | null;
  artifacts?: ChatTurnArtifact[];
}

interface ConversationSignals {
  sector: "PO" | "VO" | "MBO" | "UNK";
  studyLevel: "MBO" | "HBO" | "WO" | "UNK";
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homepage-coach`;

function inferSignals(prev: ConversationSignals, text: string): ConversationSignals {
  let sector = prev.sector;
  if (/\bpo\b|basisonderwijs|primair/i.test(text)) sector = "PO";
  else if (/\bvo\b|voortgezet|middelbare/i.test(text)) sector = "VO";
  else if (/\bmbo\b|beroepsonderwijs/i.test(text)) sector = "MBO";

  let studyLevel = prev.studyLevel;
  if (/\bmbo\b/i.test(text)) studyLevel = "MBO";
  else if (/\bhbo\b/i.test(text)) studyLevel = "HBO";
  else if (/\bwo\b|univers/i.test(text)) studyLevel = "WO";

  return { sector, studyLevel };
}

function welcomeArtifacts(): ChatTurnArtifact[] {
  return normalizeTurnArtifacts({
    primary_followup: {
      label: "Welke route past bij mij?",
      value: "Welke route past bij mij om leraar te worden?",
    },
  });
}

function fallbackArtifacts(userText: string): ChatTurnArtifact[] {
  const all = userText.toLowerCase();
  if (!/\b(route|opleiding|zij-instroom|pabo|pdg|lerarenopleiding)\b/i.test(all)) {
    return normalizeTurnArtifacts({ user_message: userText, primary_followup: { label: "Routes bekijken", value: "Welke opleidingsroutes zijn er?" } });
  }
  if (!/\b(salaris|verdien|loon|cao)\b/i.test(all)) {
    return normalizeTurnArtifacts({ user_message: userText, primary_followup: { label: "Salaris bekijken", value: "Wat verdient een leraar gemiddeld?" } });
  }
  return normalizeTurnArtifacts({ user_message: userText, primary_followup: { label: "Vacatures zoeken", value: "Welke vacatures zijn er in het onderwijs?" } });
}

export function PublicChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [signals, setSignals] = useState<ConversationSignals>({ sector: "UNK", studyLevel: "UNK" });
  const inputRef = useRef<HTMLInputElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Welkom bij het Onderwijsloket Rotterdam. Heb je een vraag over werken in het onderwijs? Ik help je graag verder.",
      artifacts: welcomeArtifacts(),
    },
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const handleOpenChat = () => setIsOpen(true);
    window.addEventListener("openDOORaiChat", handleOpenChat);
    return () => window.removeEventListener("openDOORaiChat", handleOpenChat);
  }, []);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
    else openButtonRef.current?.focus();
  }, [isOpen]);

  const resetPublicConversation = () => {
    setMessages([
      {
        role: "assistant",
        content: "Welkom bij het Onderwijsloket Rotterdam. Heb je een vraag over werken in het onderwijs? Ik help je graag verder.",
        artifacts: welcomeArtifacts(),
      },
    ]);
    setSignals({ sector: "UNK", studyLevel: "UNK" });
    setInput("");
  };

  const patchLastAssistant = (patch: Partial<Message>) => {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.role === "assistant") next[next.length - 1] = { ...last, ...patch };
      return next;
    });
  };

  const sendMessageWithText = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const nextSignals = inferSignals(signals, text);
    const userMessage: Message = { role: "user", content: text };
    const previousMessages = messages;

    setSignals(nextSignals);
    setMessages((prev) => [...prev.map((m) => (m.role === "assistant" ? { ...m, artifacts: [] } : m)), userMessage]);
    setInput("");
    setIsLoading(true);

    let assistantContent = "";
    let hasArtifacts = false;

    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...previousMessages, userMessage].slice(-10).map((m) => ({ role: m.role, content: m.content })),
          mode: "public",
          context: { signals: nextSignals, site: "door010" },
        }),
      });

      if (!response.ok || !response.body) throw new Error("Failed to get response");

      setMessages((prev) => [...prev, { role: "assistant", content: "", artifacts: [] }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEventType = "";
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

            if (currentEventType === "turn_meta" && Array.isArray(parsed.artifacts)) {
              hasArtifacts = parsed.artifacts.length > 0;
              patchLastAssistant({ artifacts: parsed.artifacts });
              currentEventType = "";
              continue;
            }

            if (currentEventType === "ui") {
              const structured = parseStructuredMeta(parsed);
              const artifacts = normalizeTurnArtifacts({
                user_message: text,
                actions: parsed.actions,
                links: parsed.links,
                verified_links: structured?.verifiedLinks,
                primary_followup: structured?.primary_followup,
              });
              hasArtifacts = artifacts.length > 0;
              patchLastAssistant({ structured, artifacts });
              currentEventType = "";
              continue;
            }

            if (parsed.meta) {
              const structured = parseStructuredMeta(parsed.meta);
              const artifacts = normalizeTurnArtifacts({
                user_message: text,
                actions: parsed.meta.actions,
                links: parsed.meta.links,
                verified_links: parsed.meta.verified_links,
                primary_followup: structured?.primary_followup,
              });
              hasArtifacts = artifacts.length > 0;
              patchLastAssistant({ structured, artifacts });
              continue;
            }

            if (Array.isArray(parsed.actions) || Array.isArray(parsed.links)) {
              const artifacts = normalizeTurnArtifacts({ user_message: text, actions: parsed.actions, links: parsed.links });
              hasArtifacts = artifacts.length > 0;
              patchLastAssistant({ artifacts });
              continue;
            }

            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              assistantContent += delta;
              patchLastAssistant({ content: assistantContent });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      assistantContent = sanitizeClientText(assistantContent);
      patchLastAssistant({ content: assistantContent });

      if (!hasArtifacts) {
        const allUserText = [...previousMessages, userMessage]
          .filter((m) => m.role === "user")
          .map((m) => m.content)
          .join(" ");
        patchLastAssistant({ artifacts: fallbackArtifacts(allUserText) });
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, er ging iets mis. Probeer het zo nog eens.",
          artifacts: normalizeTurnArtifacts({ user_message: text, primary_followup: { label: "Probeer opnieuw", value: "Kun je dat nog eens uitleggen?" } }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessageWithText(input);
  };

  if (user) return null;

  return (
    <>
      <AnimatePresence mode="wait">
        {!isOpen && !isMinimized && (
          <motion.div className="fixed z-40 bottom-5 right-5 md:bottom-6 md:right-6 flex items-center" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}>
            <motion.button ref={openButtonRef} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setIsOpen(true)} className="flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full bg-primary text-primary-foreground shadow-lg" aria-label="Open DOORai chat">
              <span className="text-xs font-semibold tracking-tight">DOORai</span>
            </motion.button>
            <button onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }} aria-label="Minimaliseer widget" className="ml-1 flex items-center justify-center w-5 h-5 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
        {!isOpen && isMinimized && (
          <motion.button key="orb" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} onClick={() => { setIsMinimized(false); setIsOpen(true); }} className="fixed z-40 bottom-4 right-4 w-8 h-8 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center" aria-label="Toon DOORai widget" title="DOORai">
            <span className="text-[10px] font-bold">D</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsOpen(false)} className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm md:hidden" aria-label="Sluit chat" tabIndex={-1} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: 40, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.98 }} transition={{ type: "spring", stiffness: 280, damping: 28 }} className="fixed z-50 flex flex-col bg-card border border-border overflow-hidden shadow-xl inset-x-0 bottom-0 rounded-t-[2rem] md:inset-auto md:bottom-6 md:right-6 md:w-[400px] md:max-w-[calc(100vw-3rem)] md:h-[560px] md:max-h-[calc(100vh-6rem)] md:rounded-[2rem]" role="dialog" aria-modal="true" aria-label="DOORai chat">
            <div className="relative px-4 pt-3 pb-3.5 shrink-0 border-b border-border bg-gradient-to-br from-primary/10 via-card to-accent/5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-bold tracking-tight text-foreground leading-tight">DOORai</h3>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Je gids naar het onderwijs</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {messages.length > 1 && (
                    <button onClick={resetPublicConversation} title="Gesprek wissen" className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground" aria-label="Gesprek wissen">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground" aria-label="Sluit chat">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5" aria-live="polite">
              {messages.map((message, index) => (
                <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                    {message.role === "assistant" ? (
                      <>
                        <CollapsibleAnswer content={message.content} structured={message.structured} compact />
                        <ChatTurnArtifacts artifacts={message.artifacts} onAsk={(value) => sendMessageWithText(value)} disabled={isLoading} compact />
                      </>
                    ) : (
                      <p className="text-[13px]">{message.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-4 py-2.5">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 border-t border-border bg-card">
              <form onSubmit={sendMessage} className="px-4 pb-3 pt-2">
                <div className="flex gap-2 items-center">
                  <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Stel je vraag..." disabled={isLoading} className="flex-1 h-9 text-sm rounded-xl" aria-label="Stel je vraag" />
                  <Button type="submit" size="sm" disabled={isLoading || !input.trim()} className="h-9 w-9 p-0 rounded-xl bg-primary hover:bg-primary/90" aria-label="Verstuur bericht">
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
