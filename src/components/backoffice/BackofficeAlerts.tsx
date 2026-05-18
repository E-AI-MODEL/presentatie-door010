import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, 
  MessageCircle, 
  AlertTriangle,
  Clock,
  UserCheck,
  HelpCircle,
  TrendingUp
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

export type AlertType = 
  | 'phase_change' 
  | 'critical_point' 
  | 'inactive' 
  | 'needs_support' 
  | 'has_question'
  | 'new_signup';

export interface DashboardAlert {
  id: string;
  type: AlertType;
  user_name: string;
  user_id: string;
  message: string;
  detail?: string;
  created_at: string;
  is_read: boolean;
  priority: 'low' | 'medium' | 'high';
}

const alertConfig: Record<AlertType, { 
  icon: typeof Bell; 
  color: string; 
  bgColor: string;
  label: string;
}> = {
  phase_change: {
    icon: TrendingUp,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    label: 'Fase wijziging',
  },
  critical_point: {
    icon: AlertTriangle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    label: 'Kritiek punt',
  },
  inactive: {
    icon: Clock,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    label: 'Inactief',
  },
  needs_support: {
    icon: HelpCircle,
    color: 'text-accent',
    bgColor: 'bg-accent/10',
    label: 'Ondersteuning nodig',
  },
  has_question: {
    icon: MessageCircle,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Vraag gesteld',
  },
  new_signup: {
    icon: UserCheck,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    label: 'Nieuwe aanmelding',
  },
};

interface BackofficeAlertsProps {
  alerts: DashboardAlert[];
  onSelectUser?: (userId: string) => void;
}

export function BackofficeAlerts({ alerts, onSelectUser }: BackofficeAlertsProps) {
  const unreadCount = alerts.filter(a => !a.is_read).length;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Meldingen</CardTitle>
            {unreadCount > 0 && (
              <Badge className="bg-accent text-accent-foreground text-xs">
                {unreadCount} nieuw
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[350px]">
          <div className="space-y-1 px-4 pb-4">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Geen recente meldingen</p>
              </div>
            ) : (
              alerts.map((alert, index) => {
                const config = alertConfig[alert.type];
                const Icon = config.icon;
                
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-3 rounded-xl border transition-colors cursor-pointer hover:bg-muted/50 ${
                      !alert.is_read ? 'bg-muted/30 border-primary/20' : 'border-transparent'
                    }`}
                    onClick={() => onSelectUser?.(alert.user_id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`rounded-full p-2 ${config.bgColor}`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm truncate">
                            {alert.user_name}
                          </p>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {format(new Date(alert.created_at), 'd MMM HH:mm', { locale: nl })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {alert.message}
                        </p>
                        {alert.detail && (
                          <p className="text-xs text-muted-foreground/80 mt-1 italic">
                            {alert.detail}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className={`text-xs ${config.color} border-current/20`}>
                            {config.label}
                          </Badge>
                          {alert.priority === 'high' && (
                            <Badge variant="destructive" className="text-xs">
                              Urgent
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
