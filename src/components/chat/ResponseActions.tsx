import type { FollowUpAction } from "@/utils/responsePipeline";

interface ResponseActionsProps {
  primaryFollowup?: FollowUpAction | null;
  secondaryAction?: FollowUpAction | null;
  onAskClick: (value: string) => void;
  compact?: boolean;
  disabled?: boolean;
}

export function ResponseActions({ primaryFollowup, secondaryAction, onAskClick, compact, disabled }: ResponseActionsProps) {
  if (!primaryFollowup && !secondaryAction) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {primaryFollowup && (
        <button
          onClick={() => onAskClick(primaryFollowup.value)}
          disabled={disabled}
          className={`px-3 py-1.5 rounded-full bg-primary/5 text-primary hover:bg-primary/15 transition-colors disabled:opacity-50 ${compact ? "text-[11px]" : "text-xs"}`}
        >
          {primaryFollowup.label}
        </button>
      )}
      {secondaryAction && (
        <button
          onClick={() => onAskClick(secondaryAction.value)}
          disabled={disabled}
          className={`px-3 py-1.5 rounded-full bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50 ${compact ? "text-[11px]" : "text-xs"}`}
        >
          {secondaryAction.label}
        </button>
      )}
    </div>
  );
}
