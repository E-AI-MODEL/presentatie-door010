// ═══════════════════════════════════════════════════════════════════
// Response Pipeline — shared types & SSE meta parser
// (alle reflect/intake/classify helpers verwijderd — die logica draait
//  server-side in doorai-chat / homepage-coach; client-versies waren
//  nooit aangeroepen.)
// ═══════════════════════════════════════════════════════════════════

export type ResponseMode = "direct" | "clarify_batch" | "source_check" | "handoff";

export type AnswerType =
  | "reproductie"
  | "wegwijs"
  | "verkenning"
  | "intake"
  | "begroeting"
  | "empathisch_steunend"
  | "bronplichtig"
  | "handoff_mens";

export interface FollowUpAction {
  label: string;
  value: string;
}

export interface VerifiedLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface StructuredResponse {
  mode?: ResponseMode;
  answer_type?: AnswerType;
  directAnswer?: string;
  supportingDetail?: string;
  verifiedLinks?: VerifiedLink[];
  collapse_recommended?: boolean;
  verification_required?: boolean;
  primary_followup?: FollowUpAction | null;
  secondary_action?: FollowUpAction | null;
}

// ── Parse Structured Meta from SSE ───────────────────────────────

export function parseStructuredMeta(data: Record<string, unknown>): StructuredResponse | null {
  const meta = (data.meta ?? data) as Record<string, unknown>;
  if (!meta || typeof meta !== "object") return null;

  const result: StructuredResponse = {};
  if (typeof meta.mode === "string") result.mode = meta.mode as ResponseMode;
  if (typeof meta.answer_type === "string") result.answer_type = meta.answer_type as AnswerType;
  if (typeof meta.direct_answer === "string") result.directAnswer = meta.direct_answer;
  if (typeof meta.supporting_detail === "string") result.supportingDetail = meta.supporting_detail;
  if (typeof meta.collapse_recommended === "boolean") result.collapse_recommended = meta.collapse_recommended;
  if (typeof meta.verification_required === "boolean") result.verification_required = meta.verification_required;

  if (meta.primary_followup && typeof meta.primary_followup === "object") {
    const pf = meta.primary_followup as Record<string, string>;
    if (pf.label && pf.value) result.primary_followup = { label: pf.label, value: pf.value };
  }

  if (meta.secondary_action && typeof meta.secondary_action === "object") {
    const sa = meta.secondary_action as Record<string, string>;
    if (sa.label && sa.value) result.secondary_action = { label: sa.label, value: sa.value };
  }

  if (Array.isArray(meta.verified_links)) {
    result.verifiedLinks = meta.verified_links
      .filter((l: unknown): l is Record<string, string> => typeof l === "object" && l !== null && "href" in l)
      .map((l) => ({
        label: l.label || "Meer info",
        href: l.href,
        external: !l.href.startsWith("/"),
      }))
      .filter((l) => l.href.startsWith("/") || /^https?:\/\//i.test(l.href));
  }

  if (
    !result.directAnswer &&
    !result.supportingDetail &&
    !result.verifiedLinks &&
    !result.primary_followup &&
    !result.secondary_action
  ) {
    return null;
  }
  return result;
}
