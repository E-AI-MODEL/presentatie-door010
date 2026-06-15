export type TurnArtifact =
  | {
      kind: "question";
      id: string;
      label: string;
      value: string;
      source?: "ai" | "doubt" | "fallback";
    }
  | {
      kind: "source";
      id: string;
      label: string;
      href: string;
      external: boolean;
      source?: "internal" | "trusted" | "faq";
    }
  | {
      kind: "status";
      id: string;
      tone: "neutral" | "warning" | "success";
      label: string;
      description?: string;
      confidence?: number;
    }
  | {
      kind: "decision";
      id: string;
      message: string;
      acceptLabel: string;
      declineLabel: string;
      acceptValue: string;
      from?: string;
      to?: string;
    };

export interface TurnMeta {
  version: 1;
  artifacts: TurnArtifact[];
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

function hasDoubtSignal(message: string): boolean {
  const lower = message.toLowerCase();
  return DOUBT_WORDS.some((word) => lower.includes(word));
}

function makeId(prefix: string, value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return `${prefix}-${slug || "item"}`;
}

function buildStatus(
  confidence?: number | null,
  reflectionIssues?: string[],
): TurnArtifact | null {
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

export function buildTurnMeta(opts: {
  userMessage: string;
  actions?: Array<{ label: string; value: string }>;
  links?: Array<{ label: string; href: string }>;
  phaseSuggestion?: {
    from?: string;
    to?: string;
    message?: string;
    acceptMessage?: string;
  };
  confidence?: number | null;
  reflectionIssues?: string[];
  includeStatus?: boolean;
}): TurnMeta {
  const artifacts: TurnArtifact[] = [];

  if (opts.phaseSuggestion?.message) {
    artifacts.push({
      kind: "decision",
      id: "decision-next-step",
      message: opts.phaseSuggestion.message,
      acceptLabel: "Ja, graag",
      declineLabel: "Nog niet",
      acceptValue:
        opts.phaseSuggestion.acceptMessage ||
        "Kun je me helpen met een logische volgende stap voor mijn situatie?",
      from: opts.phaseSuggestion.from,
      to: opts.phaseSuggestion.to,
    });

    const status = buildStatus(opts.confidence, opts.reflectionIssues);
    if (status) artifacts.push(status);
    return { version: 1, artifacts };
  }

  if (hasDoubtSignal(opts.userMessage)) {
    artifacts.push({
      kind: "question",
      id: "question-help-me-kiezen",
      label: "Help me kiezen",
      value: "Kun je mijn opties rustig naast elkaar zetten en helpen bepalen wat logisch is?",
      source: "doubt",
    });
  } else if (opts.actions?.[0]) {
    const action = opts.actions[0];
    artifacts.push({
      kind: "question",
      id: makeId("question", `${action.label}-${action.value}`),
      label: action.label,
      value: action.value,
      source: "ai",
    });
  }

  if (opts.links?.[0]) {
    const link = opts.links[0];
    artifacts.push({
      kind: "source",
      id: makeId("source", link.href),
      label: link.label,
      href: link.href,
      external: link.href.startsWith("http"),
      source: link.href.startsWith("/") ? "internal" : "trusted",
    });
  }

  if (opts.includeStatus) {
    const status = buildStatus(opts.confidence, opts.reflectionIssues);
    if (status) artifacts.push(status);
  }

  return { version: 1, artifacts };
}
