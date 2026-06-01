import { useNavigate } from "react-router-dom";
import { ArrowUpRight, MessageCircleQuestion, ClipboardCheck, FileUp, Play } from "lucide-react";
import type { FollowUpAction } from "@/utils/responsePipeline";

interface ResponseActionsProps {
  primaryFollowup?: FollowUpAction | null;
  secondaryAction?: FollowUpAction | null;
  onAskClick: (value: string) => void;
  compact?: boolean;
  disabled?: boolean;
}

type ActionKind =
  | { kind: "link"; path: string; icon: typeof ArrowUpRight; title: string }
  | { kind: "tool"; icon: typeof Play; title: string }
  | { kind: "question"; icon: typeof MessageCircleQuestion; title: string };

function classify(action: FollowUpAction): ActionKind {
  const v = (action.value || "").toLowerCase().trim();

  // Link → starts with "/" or full URL
  if (v.startsWith("/") || v.startsWith("http")) {
    const path = v.startsWith("http") ? v : v;
    return { kind: "link", path, icon: ArrowUpRight, title: "Open pagina" };
  }

  // Tool triggers
  if (v.includes("interessetest") || v.includes("doe de test")) {
    return { kind: "tool", icon: ClipboardCheck, title: "Start interessetest" };
  }
  if (v.includes("cv upload") || v.includes("upload je cv") || v.includes("upload cv")) {
    return { kind: "tool", icon: FileUp, title: "Upload je CV" };
  }

  return { kind: "question", icon: MessageCircleQuestion, title: "Vraag verder" };
}

export function ResponseActions({ primaryFollowup, secondaryAction, onAskClick, compact, disabled }: ResponseActionsProps) {
  const navigate = useNavigate();
  if (!primaryFollowup && !secondaryAction) return null;

  const renderButton = (
    action: FollowUpAction,
    variant: "primary" | "secondary",
  ) => {
    const meta = classify(action);
    const Icon = meta.icon;
    const isLink = meta.kind === "link";

    const handleClick = () => {
      if (isLink && "path" in meta) {
        if (meta.path.startsWith("http")) {
          window.open(meta.path, "_blank", "noopener,noreferrer");
        } else {
          navigate(meta.path);
        }
        return;
      }
      onAskClick(action.value);
    };

    const sizing = compact ? "text-[11px] px-2.5 py-1.5" : "text-xs px-3 py-1.5";
    const base = `inline-flex items-center gap-1.5 rounded-full transition-colors disabled:opacity-50 ${sizing}`;
    const palette =
      variant === "primary"
        ? "bg-primary/5 text-primary hover:bg-primary/15"
        : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80";

    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={meta.title}
        aria-label={`${meta.title}: ${action.label}`}
        className={`${base} ${palette}`}
      >
        {!isLink && <Icon className="h-3 w-3 shrink-0 opacity-70" aria-hidden />}
        <span className="truncate max-w-[220px]">{action.label}</span>
        {isLink && <Icon className="h-3 w-3 shrink-0 opacity-70" aria-hidden />}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {primaryFollowup && renderButton(primaryFollowup, "primary")}
      {secondaryAction && renderButton(secondaryAction, "secondary")}
    </div>
  );
}
