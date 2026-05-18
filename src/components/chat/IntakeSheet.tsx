import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { IntakeQuestion } from "@/utils/responsePipeline";

interface IntakeSheetProps {
  questions: IntakeQuestion[];
  onSubmit: (answers: Record<string, string>) => void;
  onDismiss?: () => void;
  compact?: boolean;
}

export function IntakeSheet({ questions, onSubmit, onDismiss, compact }: IntakeSheetProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [openInputs, setOpenInputs] = useState<Record<string, string>>({});

  const handleChipClick = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = () => {
    const merged = { ...answers };
    for (const q of questions) {
      if (!merged[q.id] && openInputs[q.id]?.trim()) {
        merged[q.id] = openInputs[q.id].trim();
      }
    }
    if (Object.keys(merged).length > 0) {
      onSubmit(merged);
    }
  };

  const hasAnyAnswer = Object.keys(answers).length > 0 || Object.values(openInputs).some((v) => v.trim());

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className={`bg-muted/50 border border-border rounded-2xl ${compact ? "p-3" : "p-4"} space-y-3`}
    >
      <p className="text-xs font-medium text-muted-foreground">
        Even een paar dingen weten om je beter te helpen:
      </p>

      {questions.map((q) => (
        <div key={q.id} className="space-y-1.5">
          <p className={`font-medium text-foreground ${compact ? "text-xs" : "text-sm"}`}>{q.question}</p>
          {q.type === "choice" && q.options && (
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleChipClick(q.id, opt)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    answers[q.id] === opt
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-foreground hover:border-primary/50"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
          {q.type === "open" && (
            <Input
              value={openInputs[q.id] || ""}
              onChange={(e) => setOpenInputs((prev) => ({ ...prev, [q.id]: e.target.value }))}
              placeholder="Typ je antwoord..."
              className="h-7 text-xs rounded-lg"
            />
          )}
          {/* For choice questions, also allow open input if no chip selected */}
          {q.type === "choice" && !answers[q.id] && (
            <Input
              value={openInputs[q.id] || ""}
              onChange={(e) => setOpenInputs((prev) => ({ ...prev, [q.id]: e.target.value }))}
              placeholder="Of typ je antwoord..."
              className="h-7 text-xs rounded-lg mt-1"
            />
          )}
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!hasAnyAnswer}
          className="h-7 text-xs rounded-lg"
        >
          Verstuur
        </Button>
        {onDismiss && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            className="h-7 text-xs rounded-lg text-muted-foreground"
          >
            Overslaan
          </Button>
        )}
      </div>
    </motion.div>
  );
}
