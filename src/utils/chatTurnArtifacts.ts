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
