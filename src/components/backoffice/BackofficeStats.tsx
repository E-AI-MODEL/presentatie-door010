import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { 
  Users, 
  TrendingUp,
  Clock,
  UserCheck,
  MessageCircle,
  FileText
} from "lucide-react";
import type { ProfileWithEmail } from "./UserOverviewTable";

interface BackofficeStatsProps {
  profiles: ProfileWithEmail[];
}

export function BackofficeStats({ profiles }: BackofficeStatsProps) {
  const stats = {
    total: profiles.length,
    newThisWeek: profiles.filter(p => {
      const createdDate = new Date(p.created_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return createdDate > weekAgo;
    }).length,
    byPhase: profiles.reduce((acc, p) => {
      const phase = p.current_phase || 'interesseren';
      acc[phase] = (acc[phase] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    withConversation: profiles.filter(p => (p.conversation_count ?? 0) > 0).length,
    withCV: profiles.filter(p => !!p.cv_url).length,
  };

  const statCards = [
    {
      icon: Users,
      value: stats.total,
      label: 'Totaal kandidaten',
      color: 'bg-primary/10 text-primary',
    },
    {
      icon: TrendingUp,
      value: stats.newThisWeek,
      label: 'Nieuw deze week',
      color: 'bg-primary/10 text-primary',
    },
    {
      icon: MessageCircle,
      value: stats.withConversation,
      label: 'Met gesprek',
      color: 'bg-accent/10 text-accent',
    },
    {
      icon: FileText,
      value: stats.withCV,
      label: 'CV geüpload',
      color: 'bg-primary/10 text-primary',
    },
    ...([
      { key: 'interesseren', label: 'Interesseren' },
      { key: 'orienteren', label: 'Oriënteren' },
      { key: 'beslissen', label: 'Beslissen' },
      { key: 'matchen', label: 'Matchen' },
      { key: 'voorbereiden', label: 'Voorbereiden' },
    ] as const).map(({ key, label }) => ({
      icon: key === 'matchen' ? UserCheck : Clock,
      value: stats.byPhase[key] || 0,
      label: `Fase: ${label}`,
      color: key === 'matchen' || key === 'voorbereiden' ? 'bg-primary/20 text-primary' : 'bg-accent/10 text-accent',
    })),
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {statCards.map((stat, index) => (
        <motion.div 
          key={stat.label}
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-full p-2 ${stat.color}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
