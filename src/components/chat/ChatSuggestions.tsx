import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Briefcase, GraduationCap, Calendar, BookOpen, ClipboardCheck, FileUp } from "lucide-react";

interface ChatAction {
  label: string;
  value: string;
}

interface ChatSuggestionsProps {
  actions: ChatAction[];
  onActionClick: (value: string) => void;
  disabled?: boolean;
}

const ROUTE_MAP: Record<string, { icon: React.ElementType; description: string; path: string }> = {
  "/vacatures": { icon: Briefcase, description: "Bekijk beschikbare vacatures", path: "/vacatures" },
  "/opleidingen": { icon: GraduationCap, description: "Ontdek opleidingsmogelijkheden", path: "/opleidingen" },
  "/events": { icon: Calendar, description: "Bekijk komende evenementen", path: "/events" },
  "/kennisbank": { icon: BookOpen, description: "Lees meer in de kennisbank", path: "/kennisbank" },
};

const TOOL_KEYWORDS: Record<string, { icon: React.ElementType; description: string }> = {
  interessetest: { icon: ClipboardCheck, description: "Doe de interessetest" },
  test: { icon: ClipboardCheck, description: "Doe de interessetest" },
  cv: { icon: FileUp, description: "Upload je CV" },
};

function classifyAction(action: ChatAction) {
  const val = action.value.toLowerCase();

  // Check for route links
  for (const [route, info] of Object.entries(ROUTE_MAP)) {
    if (val.includes(route)) {
      return { type: "link" as const, ...info, label: action.label };
    }
  }

  // Check for tool references
  for (const [keyword, info] of Object.entries(TOOL_KEYWORDS)) {
    if (val.includes(keyword)) {
      return { type: "tool" as const, ...info, label: action.label, value: action.value };
    }
  }

  return { type: "pill" as const, label: action.label, value: action.value };
}

export function ChatSuggestions({ actions, onActionClick, disabled }: ChatSuggestionsProps) {
  const navigate = useNavigate();

  if (actions.length === 0) return null;

  const classified = actions.map(classifyAction);
  const cards = classified.filter((c) => c.type === "link" || c.type === "tool");
  const pills = classified.filter((c) => c.type === "pill");

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <p className="text-xs text-muted-foreground">Suggesties</p>

      {cards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {cards.map((card, i) => {
            const Icon = "icon" in card ? card.icon : null;
            const isLink = card.type === "link";

            return (
              <button
                key={i}
                disabled={disabled}
                onClick={() => {
                  if (isLink && "path" in card) {
                    navigate(card.path);
                  } else if ("value" in card) {
                    onActionClick(card.value);
                  }
                }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-muted/50 px-4 py-3 text-left transition-colors hover:bg-primary/5 hover:border-primary/30 disabled:opacity-50 group"
              >
                {Icon && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{card.label}</p>
                  {"description" in card && (
                    <p className="text-xs text-muted-foreground truncate">{card.description}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {pills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pills.map((pill, i) => (
            <button
              key={i}
              onClick={() => "value" in pill && onActionClick(pill.value)}
              disabled={disabled}
              className="px-4 py-2 text-sm rounded-full transition-colors border h-10 inline-flex items-center justify-center bg-background border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              <span className="max-w-[260px] truncate">{pill.label}</span>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
