import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import type { PhaseInfo } from "@/data/dashboard-phases";

interface PhaseCardProps {
  phaseInfo: PhaseInfo;
}

export function PhaseCard({ phaseInfo }: PhaseCardProps) {
  const PhaseIcon = phaseInfo.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-lg border border-border overflow-hidden"
    >
      <div className={`${phaseInfo.color} p-4 flex items-center gap-4`}>
        <div className="bg-white/20 rounded-full p-3">
          <PhaseIcon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">
            Fase: {phaseInfo.title}
          </h2>
          <p className="text-white/90 text-sm">{phaseInfo.subtitle}</p>
        </div>
      </div>
      
      <div className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
          Aanbevolen acties
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {phaseInfo.actions.map((action, index) => (
            <Link
              key={index}
              to={action.href}
              className="group flex flex-col p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              <action.icon className="h-5 w-5 text-primary mb-2" />
              <span className="font-medium text-foreground text-sm group-hover:text-primary">
                {action.label}
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">
                {action.description}
              </span>
            </Link>
          ))}
        </div>
        {phaseInfo.tips[0] && (
          <p className="text-xs text-muted-foreground mt-3 italic">
            <CheckCircle2 className="inline h-3 w-3 text-primary mr-1" />
            {phaseInfo.tips[0]}
          </p>
        )}
      </div>
    </motion.div>
  );
}
