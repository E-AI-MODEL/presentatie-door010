export type ChatTurnArtifact =
  | ChatQuestionArtifact
  | ChatSourceArtifact
  | ChatStatusArtifact
  | ChatDecisionArtifact;

export interface ChatQuestionArtifact {
  kind: "question";
  id: string;
  label: string;
  value: string;
  source?: "ai" | "doubt" | "fallback";
}

export interface ChatSourceArtifact {
  kind: "source";
  id: string;
  label: string;
  href: string;
  external: boolean;
  source?: "internal" | "trusted" | "faq";
}

export interface ChatStatusArtifact {
  kind: "status";
  id: string;
  tone: "neutral" | "warning" | "success";
  label: string;
  description?: string;
  confidence?: number;
}

export interface ChatDecisionArtifact {
  kind: "decision";
  id: string;
  message: string;
  acceptLabel: string;
  declineLabel: string;
  acceptValue: string;
  from?: string;
  to?: string;
}

interface RawTurnMeta {
  actions?: Array<{ label?: string; value?: string; href?: string }>;
  links?: Array<{ label?: string; href?: string; external?: boolean }>;
  verified_links?: Array<{ label?: string; href?: string; external?: boolean }>;
  primary_followup?: { label?: string; value?: string } | null;
  secondary_action?: { label?: string; value?: string } | null;
  phase_suggestion?: {
    from?: string;
    to?: string;
    message?: string;
    acceptMessage?: string;
  } | null;
  confidence?: number | null;
  reflection_issues?: string[] | null;
  user_message?: string;
  include_status?: boolean;
}

const DOUBT_WORDS = [
  "twijfel",
  "weet niet",
  "lastig kiezen",
  "keuze maken",
  "past dit",
  "wel of niet",
  "onzeker",
];

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stableId(prefix: string, value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return `${prefix}-${slug || "item"}`;
}

function isValidHref(href: string): boolean {
  return href.startsWith("/") || /^https?:\/\//i.test(href);
}

function isDoubtMessage(message?: string): boolean {
  const lower = (message || "").toLowerCase();
  return DOUBT_WORDS.some((word) => lower.includes(word));
}

export function normalizeTurnArtifacts(meta: RawTurnMeta): ChatTurnArtifact[] {
  const artifacts: ChatTurnArtifact[] = [];
  const userMessage = meta.user_message ?? "";

  if (meta.phase_suggestion?.message) {
    artifacts.push({
      kind: "decision",
      id: "decision-next-step",
      message: clean(meta.phase_suggestion.message),
      acceptLabel: "Ja, graag",
      declineLabel: "Nog niet",
      acceptValue:
        clean(meta.phase_suggestion.acceptMessage) ||
        "Kun je me helpen met een logische volgende stap voor mijn situatie?",
      from: clean(meta.phase_suggestion.from),
      to: clean(meta.phase_suggestion.to),
    });

    const status = buildStatusArtifact(meta.confidence, meta.reflection_issues);
    if (status) artifacts.push(status);
    return artifacts;
  }

  if (isDoubtMessage(userMessage)) {
    artifacts.push({
      kind: "question",
      id: "question-help-me-kiezen",
      label: "Help me kiezen",
      value: "Kun je mijn opties rustig naast elkaar zetten en helpen bepalen wat logisch is?",
      source: "doubt",
    });
  } else {
    const action = normalizeAction(meta.primary_followup) || normalizeAction(meta.actions?.[0]);
    if (action) artifacts.push(action);
  }

  const source = normalizeSource(meta.verified_links?.[0]) || normalizeSource(meta.links?.[0]);
  if (source) artifacts.push(source);

  if (meta.include_status) {
    const status = buildStatusArtifact(meta.confidence, meta.reflection_issues);
    if (status) artifacts.push(status);
  }

  return dedupeArtifacts(artifacts);
}

function normalizeAction(raw: unknown): ChatQuestionArtifact | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const label = clean(obj.label);
  const value = clean(obj.value) || clean(obj.href);
  if (!label || !value) return null;

  return {
    kind: "question",
    id: stableId("question", `${label}-${value}`),
    label,
    value,
    source: "ai",
  };
}

function normalizeSource(raw: unknown): ChatSourceArtifact | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const href = clean(obj.href);
  if (!href || !isValidHref(href)) return null;

  return {
    kind: "source",
    id: stableId("source", href),
    label: clean(obj.label) || (href.startsWith("/") ? "Pagina" : "Bron"),
    href,
    external: href.startsWith("http"),
    source: href.startsWith("/") ? "internal" : "trusted",
  };
}

function buildStatusArtifact(
  confidence?: number | null,
  reflectionIssues?: string[] | null,
): ChatStatusArtifact | null {
  const hasIssues = Array.isArray(reflectionIssues) && reflectionIssues.length > 0;
  if (typeof confidence !== "number" && !hasIssues) return null;

  if (typeof confidence === "number" && confidence < 0.55) {
    return {
      kind: "status",
      id: "status-low-confidence",
      tone: "warning",
      label: "Nog niet zeker",
      description: "Vertel iets meer als je een scherper antwoord wilt.",
      confidence,
    };
  }

  if (typeof confidence === "number" && confidence < 0.75) {
    return {
      kind: "status",
      id: "status-medium-confidence",
      tone: "neutral",
      label: "Redelijk zeker",
      description: "Gebaseerd op wat je tot nu toe deelde.",
      confidence,
    };
  }

  if (hasIssues) {
    return {
      kind: "status",
      id: "status-output-warning",
      tone: "warning",
      label: "Antwoord gecontroleerd",
      description: "Er is iets gecorrigeerd voordat dit antwoord werd getoond.",
      confidence: typeof confidence === "number" ? confidence : undefined,
    };
  }

  return null;
}

function dedupeArtifacts(artifacts: ChatTurnArtifact[]): ChatTurnArtifact[] {
  const decision = artifacts.find((a) => a.kind === "decision");
  const question = artifacts.find((a) => a.kind === "question");
  const source = artifacts.find((a) => a.kind === "source");
  const status = artifacts.find((a) => a.kind === "status");

  if (decision) return [decision, status].filter(Boolean) as ChatTurnArtifact[];
  return [question, source, status].filter(Boolean) as ChatTurnArtifact[];
}
