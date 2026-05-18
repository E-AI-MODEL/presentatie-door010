import type { ProfileWithEmail } from "./UserOverviewTable";

type OrientationPhase = 'interesseren' | 'orienteren' | 'beslissen' | 'matchen' | 'voorbereiden';

const phases: OrientationPhase[] = ['interesseren', 'orienteren', 'beslissen', 'matchen', 'voorbereiden'];

const phaseLabels: Record<OrientationPhase, string> = {
  interesseren: 'Interesseren',
  orienteren: 'Oriënteren',
  beslissen: 'Beslissen',
  matchen: 'Matchen',
  voorbereiden: 'Voorbereiden',
};

interface PhaseStatusBarProps {
  profile: ProfileWithEmail;
}

export function PhaseStatusBar({ profile }: PhaseStatusBarProps) {
  const currentPhase = profile.current_phase || 'interesseren';
  const currentIndex = phases.indexOf(currentPhase as OrientationPhase);

  return (
    <div className="flex items-center gap-0.5 w-full overflow-hidden">
      {phases.map((phase, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={phase} className="flex-1 min-w-0 flex flex-col items-center gap-0.5">
            <div
              className={`h-2 w-full rounded-full transition-colors ${
                isCompleted
                  ? 'bg-primary'
                  : isCurrent
                  ? 'bg-accent'
                  : 'bg-muted'
              }`}
            />
            <span className={`text-[9px] md:text-[10px] leading-tight truncate w-full text-center ${
              isCurrent ? 'font-semibold text-accent' : isCompleted ? 'text-primary' : 'text-muted-foreground'
            }`}>
              {phaseLabels[phase]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
