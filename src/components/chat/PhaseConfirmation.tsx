import { Button } from "@/components/ui/button";

interface PhaseConfirmationProps {
  message: string;
  onAccept: () => void;
  onDecline: () => void;
  compact?: boolean;
}

export function PhaseConfirmation({ message, onAccept, onDecline, compact }: PhaseConfirmationProps) {
  return (
    <div className={`rounded-xl border border-primary/20 bg-primary/5 ${compact ? "p-3" : "p-4"}`}>
      <p className={`${compact ? "text-xs" : "text-sm"} text-foreground mb-3`}>{message}</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={onAccept}
          className={`${compact ? "h-7 text-xs" : "h-8 text-sm"}`}
        >
          Ja, graag
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDecline}
          className={`${compact ? "h-7 text-xs" : "h-8 text-sm"} text-muted-foreground`}
        >
          Nog niet
        </Button>
      </div>
    </div>
  );
}
