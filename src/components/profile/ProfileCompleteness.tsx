import { Progress } from "@/components/ui/progress";

interface ProfileCompletenessProps {
  firstName: string | null;
  phone: string | null;
  bio: string | null;
  preferredSector: string | null;
  testCompleted: boolean;
  cvUrl: string | null;
}

interface CompletenessItem {
  label: string;
  weight: number;
  filled: boolean;
}

export function ProfileCompleteness(props: ProfileCompletenessProps) {
  const items: CompletenessItem[] = [
    { label: "Naam", weight: 20, filled: !!props.firstName?.trim() },
    { label: "Telefoon", weight: 10, filled: !!props.phone?.trim() },
    { label: "Bio", weight: 10, filled: !!props.bio?.trim() },
    { label: "Sector", weight: 20, filled: !!props.preferredSector },
    { label: "Interessetest", weight: 20, filled: props.testCompleted },
    { label: "CV", weight: 20, filled: !!props.cvUrl },
  ];

  const score = items.reduce((acc, item) => acc + (item.filled ? item.weight : 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
          Profiel compleetheid
        </span>
        <span className="text-sm font-bold text-primary">{score}%</span>
      </div>
      <Progress value={score} className="h-2" />
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item.label}
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              item.filled
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {item.filled ? "✓" : "○"} {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
