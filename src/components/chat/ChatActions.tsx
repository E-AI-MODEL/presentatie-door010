import { motion } from "framer-motion";

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
      <p className="text-xs text-muted-foreground mb-2">Suggesties</p>
      <div className="flex flex-wrap gap-2">
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={() => onActionClick(action.value)}
          disabled={disabled}
          className="px-4 py-2 text-sm rounded-full transition-colors border h-10 inline-flex items-center justify-center bg-background border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          <span className="max-w-[260px] truncate">{action.label}</span>
        </button>
      ))}
      </div>
    </motion.div>
  );
}
