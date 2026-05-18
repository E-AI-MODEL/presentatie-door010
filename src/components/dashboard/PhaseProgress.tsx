import type { OrientationPhase } from "@/data/dashboard-phases";
import { phases, phaseData } from "@/data/dashboard-phases";

interface PhaseProgressProps {
  currentPhase: OrientationPhase;
}

export function PhaseProgress({ currentPhase }: PhaseProgressProps) {
  const currentPhaseIndex = phases.indexOf(currentPhase);

  return (
    <section className="bg-card border-b border-border py-2.5">
      <div className="container">
        <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {phases.map((phase, index) => {
            const isActive = index === currentPhaseIndex;
            const isCompleted = index < currentPhaseIndex;
            const data = phaseData[phase];

            return (
              <div key={phase} className="flex items-center">
                <div
                  className={`flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span
                    className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold ${
                      isActive ? "bg-white/30" : isCompleted ? "bg-primary/30" : "bg-muted-foreground/20"
                    }`}
                  >
                    {isCompleted ? "✓" : index + 1}
                  </span>
                  <span>{data.title}</span>
                </div>
                {index < phases.length - 1 && (
                  <div className={`w-2 sm:w-4 h-0.5 mx-0.5 ${isCompleted ? "bg-primary/40" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
