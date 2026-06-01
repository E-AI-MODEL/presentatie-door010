import { motion } from "framer-motion";
import { MessageCircleQuestion } from "lucide-react";

interface ChatAction {
  label: string;
  value: string;
}

interface ChatActionsProps {
  actions: ChatAction[];
  onActionClick: (value: string) => void;
  disabled?: boolean;
}

export function ChatActions({ actions, onActionClick, disabled }: ChatActionsProps) {
  if (actions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="container max-w-3xl mx-auto py-3"
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
        Vraag verder over…
      </p>
      <div className="flex flex-wrap gap-2">
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={() => onActionClick(action.value)}
            disabled={disabled}
            title="Vraag verder"
            className="px-4 py-2 text-sm rounded-full transition-colors border h-10 inline-flex items-center justify-center gap-1.5 bg-background border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            <MessageCircleQuestion className="h-3.5 w-3.5 opacity-70 shrink-0" aria-hidden />
            <span className="max-w-[260px] truncate">{action.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
