import { Link, useNavigate } from "react-router-dom";
import { Check, ExternalLink, MessageCircleQuestion, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ChatDecisionArtifact,
  ChatQuestionArtifact,
  ChatSourceArtifact,
  ChatStatusArtifact,
  ChatTurnArtifact,
} from "@/utils/chatTurnArtifacts";

interface ChatTurnArtifactsProps {
  artifacts?: ChatTurnArtifact[];
  onAsk: (value: string) => void;
  onDecisionAccept?: (artifact: ChatDecisionArtifact) => void;
  onDecisionDecline?: (artifact: ChatDecisionArtifact) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function ChatTurnArtifacts({
  artifacts = [],
  onAsk,
  onDecisionAccept,
  onDecisionDecline,
  disabled,
  compact,
}: ChatTurnArtifactsProps) {
  if (artifacts.length === 0) return null;

  const decision = artifacts.find((a): a is ChatDecisionArtifact => a.kind === "decision");
  const questions = artifacts.filter((a): a is ChatQuestionArtifact => a.kind === "question").slice(0, 2);
  const sources = artifacts.filter((a): a is ChatSourceArtifact => a.kind === "source").slice(0, 2);
  const status = artifacts.find((a): a is ChatStatusArtifact => a.kind === "status");

  return (
    <div className="mt-2 space-y-2">
      {decision ? (
        <DecisionCard
          artifact={decision}
          onAccept={onDecisionAccept}
          onDecline={onDecisionDecline}
          disabled={disabled}
          compact={compact}
        />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {questions.map((q) => (
            <QuestionButton key={q.id} artifact={q} onAsk={onAsk} disabled={disabled} compact={compact} />
          ))}
          {sources.map((s) => (
            <SourceLink key={s.id} artifact={s} compact={compact} />
          ))}
        </div>
      )}

      {status && <StatusLine artifact={status} compact={compact} />}
    </div>
  );
}

function QuestionButton({
  artifact,
  onAsk,
  disabled,
  compact,
}: {
  artifact: ChatQuestionArtifact;
  onAsk: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (disabled) return;
    if (artifact.value.startsWith("http")) {
      window.open(artifact.value, "_blank", "noopener,noreferrer");
      return;
    }
    if (artifact.value.startsWith("/")) {
      navigate(artifact.value);
      return;
    }
    onAsk(artifact.value);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium transition-colors disabled:opacity-50",
        "bg-primary text-primary-foreground hover:bg-primary/90",
        compact ? "text-[11px] px-2.5 py-1.5" : "text-xs px-3 py-1.5",
      )}
      aria-label={`Vervolgvraag: ${artifact.label}`}
      title="Stel vervolgvraag"
    >
      <MessageCircleQuestion className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
      <span className="truncate max-w-[220px]">{artifact.label}</span>
    </button>
  );
}

function SourceLink({ artifact, compact }: { artifact: ChatSourceArtifact; compact?: boolean }) {
  const className = cn(
    "inline-flex items-center gap-1.5 rounded-full border border-border bg-background text-foreground",
    "hover:bg-muted transition-colors",
    compact ? "text-[11px] px-2.5 py-1.5" : "text-xs px-3 py-1.5",
  );

  if (!artifact.external) {
    return (
      <Link to={artifact.href} className={className} aria-label={`Open pagina: ${artifact.label}`} title="Open pagina">
        <span className="text-muted-foreground">Pagina</span>
        <span className="truncate max-w-[180px]">{artifact.label}</span>
      </Link>
    );
  }

  return (
    <a
      href={artifact.href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={`Open bron: ${artifact.label}`}
      title="Open bron"
    >
      <span className="text-muted-foreground">Bron</span>
      <span className="truncate max-w-[180px]">{artifact.label}</span>
      <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
    </a>
  );
}

function StatusLine({ artifact, compact }: { artifact: ChatStatusArtifact; compact?: boolean }) {
  const dotClass =
    artifact.tone === "warning" ? "bg-amber-500" : artifact.tone === "success" ? "bg-emerald-500" : "bg-muted-foreground/60";

  return (
    <div
      className={cn("flex items-start gap-1.5 text-muted-foreground", compact ? "text-[11px]" : "text-xs")}
      role="status"
      aria-label={`${artifact.label}. ${artifact.description ?? ""}`}
    >
      <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", dotClass)} />
      <span>
        <span className="font-medium">{artifact.label}</span>
        {artifact.description ? ` - ${artifact.description}` : null}
      </span>
    </div>
  );
}

function DecisionCard({
  artifact,
  onAccept,
  onDecline,
  disabled,
  compact,
}: {
  artifact: ChatDecisionArtifact;
  onAccept?: (artifact: ChatDecisionArtifact) => void;
  onDecline?: (artifact: ChatDecisionArtifact) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border border-primary/20 bg-primary/5", compact ? "p-3" : "p-4")}>
      <p className={cn("text-foreground mb-3", compact ? "text-xs" : "text-sm")}>{artifact.message}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => onAccept?.(artifact)}
          disabled={disabled}
          className={cn(compact ? "h-7 text-xs" : "h-8 text-sm")}
        >
          <Check className="h-3 w-3 mr-1" />
          {artifact.acceptLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onDecline?.(artifact)}
          disabled={disabled}
          className={cn("text-muted-foreground", compact ? "h-7 text-xs" : "h-8 text-sm")}
        >
          <X className="h-3 w-3 mr-1" />
          {artifact.declineLabel}
        </Button>
      </div>
    </div>
  );
}
