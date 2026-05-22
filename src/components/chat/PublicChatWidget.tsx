import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, X, Send, Bot, Mail, Phone, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { CollapsibleAnswer } from "@/components/chat/CollapsibleAnswer";
import { ResponseActions } from "@/components/chat/ResponseActions";
import {
  parseStructuredMeta,
} from "@/utils/responsePipeline";
import type { StructuredResponse, FollowUpAction } from "@/utils/responsePipeline";
import { decideConversationMode } from "@/utils/conversationRouter";
import type { TurnVisibility } from "@/utils/conversationRouter";

// ===== Types =====

interface Message {
  role: "user" | "assistant";
  content: string;
  structured?: StructuredResponse | null;
  primaryFollowup?: FollowUpAction | null;
}

interface ConversationSignals {
  sector: "PO" | "VO" | "MBO" | "UNK";
  studyLevel: "MBO" | "HBO" | "WO" | "UNK";
}

// ===== Constants =====

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homepage-coach`;

// ===== Helpers =====

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

// ===== Component =====

export function PublicChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [latestLinks, setLatestLinks] = useState<Array<{ label: string; href: string }>>([]);
  const [turnVisibility, setTurnVisibility] = useState<TurnVisibility | null>(null);

  const [signals, setSignals] = useState<ConversationSignals>({
    sector: "UNK",
    studyLevel: "UNK",
  });

  const initialFollowups: Pick<Message, "primaryFollowup"> = {
    primaryFollowup: { label: "Welke route past bij mij?", value: "Welke route past bij mij om leraar te worden?" },
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Welkom bij het Onderwijsloket Rotterdam. Heb je een vraag over werken in het onderwijs? Ik help je graag verder.",
      ...initialFollowups,
    },
  ]);

  const resetPublicConversation = () => {
    setMessages([
      {
        role: "assistant",
        content: "Welkom bij het Onderwijsloket Rotterdam. Heb je een vraag over werken in het onderwijs? Ik help je graag verder.",
        ...initialFollowups,
      },
    ]);
    setInput("");
    setLatestLinks([]);
    setTurnVisibility(null);
    setSignals({ sector: "UNK", studyLevel: "UNK" });
  };

  // Get latest followups from last assistant message
  const latestFollowups = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && m.primaryFollowup) {
        return { primaryFollowup: m.primaryFollowup };
      }
    }
    return { primaryFollowup: null };
  }, [messages]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const handleOpenChat = () => setIsOpen(true);
    window.addEventListener("openDOORaiChat", handleOpenChat);
    return () => window.removeEventListener("openDOORaiChat", handleOpenChat);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      openButtonRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const sendMessageWithText = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const nextSignals = inferSignals(signals, text);
    setSignals(nextSignals);

    const userMessage: Message = { role: "user", content: text };
    // Clear followups from ALL previous messages so old chips don't persist
    setMessages((prev) => [
      ...prev.map((m) => m.role === "assistant" ? { ...m, primaryFollowup: null } : m),
      userMessage,
    ]);
    setInput("");
    setIsLoading(true);
    setLatestLinks([]);
    setTurnVisibility(null);

    let assistantContent = "";

    try {
      const conversationWindow = [...messages, userMessage].slice(-10);

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: conversationWindow.map((m) => ({ role: m.role, content: m.content })),
          mode: "public",
          context: { signals: nextSignals, site: "door010" },
        }),
      });

      if (!response.ok || !response.body) throw new Error("Failed to get response");

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEventType = "";
      let parsedMeta: StructuredResponse | null = null;
      let turnHasActions = false;
      let turnHasLinks = false;
      let hasExternalResults = false;
      let offersExternalSearch = false;

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
            currentEventType = line.slice(7).trim();
            continue;
          }

          if (line.startsWith(":") || line.trim() === "") {
            if (line.trim() === "") currentEventType = "";
            continue;
          }
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);

            // Handle event: ui
            if (currentEventType === "ui") {
              parsedMeta = parseStructuredMeta(parsed);

              // Extract actions from payload
              let pf: FollowUpAction | null = null;
              if (parsedMeta?.primary_followup) pf = parsedMeta.primary_followup;
              if (parsedMeta?.verifiedLinks?.length) {
                setLatestLinks(parsedMeta.verifiedLinks.slice(0, 3).map((link) => ({ label: link.label, href: link.href })));
                turnHasLinks = true;
              }

              const maybeOffer = parsed?.meta?.offers_external_search ?? parsed?.offers_external_search ?? parsed?.meta?.external_search_offer ?? parsed?.external_search_offer;
              const maybeExternalResults = parsed?.meta?.has_external_results ?? parsed?.has_external_results ?? parsed?.meta?.external_results_count ?? parsed?.external_results_count;
              offersExternalSearch = offersExternalSearch || maybeOffer === true;
              hasExternalResults = hasExternalResults || (typeof maybeExternalResults === "number" ? maybeExternalResults > 0 : maybeExternalResults === true);

              // Fallback: parse actions array from payload
              if (!pf && parsed.actions && Array.isArray(parsed.actions) && parsed.actions.length > 0) {
                pf = { label: parsed.actions[0].label, value: parsed.actions[0].value };
              }
              if (pf) turnHasActions = true;
              if (parsed.links && Array.isArray(parsed.links)) {
                setLatestLinks(parsed.links.slice(0, 3));
                turnHasLinks = parsed.links.length > 0;
              }

              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  last.structured = parsedMeta;
                  last.primaryFollowup = pf;
                }
                return [...updated];
              });

              currentEventType = "";
              continue;
            }

            // Handle meta event from homepage-coach (sent as data: {meta: {...}})
            if (parsed.meta) {
              parsedMeta = parseStructuredMeta(parsed.meta);
              const metaActions = parsed.meta.actions;
              let pf: FollowUpAction | null = null;
              if (Array.isArray(metaActions) && metaActions.length > 0) {
                pf = { label: metaActions[0].label, value: metaActions[0].value };
                turnHasActions = true;
              }
              offersExternalSearch = offersExternalSearch || parsed.meta.offers_external_search === true || parsed.meta.external_search_offer === true;
              hasExternalResults = hasExternalResults || parsed.meta.has_external_results === true || (typeof parsed.meta.external_results_count === "number" && parsed.meta.external_results_count > 0);
              if (parsed.meta.verified_links && Array.isArray(parsed.meta.verified_links)) {
                setLatestLinks(parsed.meta.verified_links.slice(0, 3));
                turnHasLinks = parsed.meta.verified_links.length > 0;
              }
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  last.structured = parsedMeta;
                  last.primaryFollowup = pf;
                }
                return [...updated];
              });
              continue;
            }

            // Legacy actions fallback
            if (parsed.actions && Array.isArray(parsed.actions)) {
              const pf = parsed.actions[0] ? { label: parsed.actions[0].label, value: parsed.actions[0].value } : null;
              turnHasActions = parsed.actions.length > 0;
              if (parsed.links && Array.isArray(parsed.links)) {
                setLatestLinks(parsed.links.slice(0, 3));
                turnHasLinks = parsed.links.length > 0;
              }
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  last.primaryFollowup = pf;
                }
                return [...updated];
              });
              continue;
            }

            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              assistantContent += delta;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], role: "assistant", content: assistantContent };
                return updated;
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // If no actions came from backend, generate thematic defaults
      let fallbackAddedActions = false;
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant" && !last.primaryFollowup) {
          fallbackAddedActions = true;
          // Use conversation context for better defaults
          const allText = updated.filter((m) => m.role === "user").map((m) => m.content.toLowerCase()).join(" ");
          const mentionsRoute = /\b(route|opleiding|zij-instroom|pabo|pdg|lerarenopleiding)\b/i.test(allText);
          const mentionsSalary = /\b(salaris|verdien|loon|cao)\b/i.test(allText);
          if (!mentionsRoute) {
            last.primaryFollowup = { label: "Routes bekijken", value: "Welke opleidingsroutes zijn er?" };
          } else if (!mentionsSalary) {
            last.primaryFollowup = { label: "Salaris bekijken", value: "Wat verdient een leraar gemiddeld?" };
          } else {
            last.primaryFollowup = { label: "Vacatures zoeken", value: "Welke vacatures zijn er in het onderwijs?" };
          }
        }
        return [...updated];
      });
      if (fallbackAddedActions) turnHasActions = true;

      const vis = decideConversationMode({
        pipeline: "general",
        hasActions: turnHasActions,
        hasLinks: turnHasLinks,
        hasExternalResults,
        offersExternalSearch,
        assistantContentShort: assistantContent.split(/[.!?]+/).filter((s) => s.trim().length > 5).length <= 2,
      });
      setTurnVisibility(vis);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, er ging iets mis. Probeer het zo nog eens.",
          primaryFollowup: { label: "Probeer opnieuw", value: "Kun je dat nog eens uitleggen?" },
        },
      ]);
      setTurnVisibility(null);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessageWithText(input);
  };

  // When logged in, the AuthenticatedChatOverlay handles chat globally
  if (user) return null;

  return (
    <>
      {/* Floating launcher — distinctive pill with DOORai arrow */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            ref={openButtonRef}
            initial={{ scale: 0, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            onClick={() => setIsOpen(true)}
            className="fixed z-40 bottom-5 right-5 md:bottom-6 md:right-6 flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-[1.5rem] bg-primary text-primary-foreground shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.6)] hover:shadow-[0_14px_40px_-10px_hsl(var(--primary)/0.75)] transition-shadow"
            aria-label="Open DOORai chat"
          >
            <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-primary-foreground/15">
              <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
                <path d="M10 20H28M28 20L22 14M28 20L22 26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent animate-pulse" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Vraag DOORai</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Backdrop — mobile only, blocks page interaction & prevents overlap */}
      <AnimatePresence>
        {isOpen && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm md:hidden"
            aria-label="Sluit chat"
            tabIndex={-1}
          />
        )}
      </AnimatePresence>

      {/* Chat panel — bottom sheet on mobile, floating card on desktop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="fixed z-50 flex flex-col bg-card border border-border overflow-hidden shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.35)] inset-x-0 bottom-0 rounded-t-[2rem] max-h-[88vh] md:inset-auto md:bottom-6 md:right-6 md:w-[400px] md:max-w-[calc(100vw-3rem)] md:h-[560px] md:max-h-[calc(100vh-6rem)] md:rounded-[2rem]"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            role="dialog"
            aria-modal="true"
            aria-label="DOORai chat"
          >
            {/* Mobile grab handle */}
            <div className="md:hidden flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header — branded gradient, not a flat colored bar */}
            <div className="relative px-4 pt-3 pb-3.5 shrink-0 border-b border-border bg-gradient-to-br from-primary/10 via-card to-accent/5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0 flex items-center justify-center w-10 h-10 rounded-2xl bg-primary text-primary-foreground shadow-md">
                    <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
                      <path d="M10 20H28M28 20L22 14M28 20L22 26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent border-2 border-card" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold tracking-tight text-foreground leading-tight">DOORai</h3>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Je gids naar het onderwijs</p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {messages.length > 1 && (
                    <button
                      onClick={resetPublicConversation}
                      title="Gesprek wissen"
                      className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                      aria-label="Gesprek wissen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <a
                    href="mailto:info@onderwijsloketrotterdam.nl"
                    title="E-mail ons"
                    className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Mail className="h-3.5 w-3.5" />
                  </a>
                  <a
                    href="tel:+31107940000"
                    title="Bel ons"
                    className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Sluit chat"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>


            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5" aria-live="polite">
              {messages.map((message, index) => (
                <div key={index}>
                  <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <CollapsibleAnswer
                          content={message.content}
                          structured={message.structured}
                          compact
                        />
                      ) : (
                        <p className="text-[13px]">{message.content}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
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

            {/* Bottom area: intake + actions + input */}
            <div className="shrink-0 border-t border-border bg-card">
              {/* Action buttons */}
              {!isLoading && latestFollowups.primaryFollowup && (turnVisibility?.showActionChip !== false) && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-4 pt-2.5 pb-1"
                >
                  <ResponseActions
                    primaryFollowup={latestFollowups.primaryFollowup}
                    secondaryAction={null}
                    onAskClick={(value) => sendMessageWithText(value)}
                    compact
                  />
                </motion.div>
              )}

              {/* Link chip */}
              {!isLoading && latestLinks.length > 0 && (turnVisibility?.showLinkChip !== false) && (
                <div className="px-4 pt-2.5 pb-1 flex flex-wrap gap-1.5">
                  {latestLinks
                    .filter(link => link.href.startsWith("/") || /^https?:\/\//i.test(link.href))
                    .map((link, index) => (
                    link.href.startsWith("/") ? (
                      <Link
                        key={`${link.href}-${index}`}
                        to={link.href}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        key={`${link.href}-${index}`}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                      >
                        {link.label}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )
                  ))}
                </div>
              )}

              {/* Input */}
              <form onSubmit={sendMessage} className="px-4 pb-3 pt-2">
                <div className="flex gap-2 items-center">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Stel je vraag…"
                    disabled={isLoading}
                    className="flex-1 h-9 text-sm rounded-xl"
                    aria-label="Stel je vraag"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isLoading || !input.trim()}
                    className="h-9 w-9 p-0 rounded-xl bg-primary hover:bg-primary/90"
                    aria-label="Verstuur bericht"
                  >
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
