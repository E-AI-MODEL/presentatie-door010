import { motion } from "framer-motion";
import { Calendar, ExternalLink, Clock, Loader2 } from "lucide-react";
import { useScrapedEvents } from "@/hooks/useScrapedEvents";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";

export function ScrapedEventsList() {
  const { data, isLoading, error, refetch, isFetching } = useScrapedEvents();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Events ophalen...</span>
      </div>
    );
  }

  if (error || data?.error) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          Kon events niet laden. Probeer het later opnieuw.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Opnieuw proberen
        </Button>
      </div>
    );
  }

  const events = data?.events || [];

  if (events.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-lg">
        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground mb-2">Geen events gevonden</p>
        <p className="text-sm text-muted-foreground">
          De externe bronnen worden automatisch gescraped.
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()} 
          className="mt-4"
          disabled={isFetching}
        >
          {isFetching ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Bezig...
            </>
          ) : (
            "Handmatig vernieuwen"
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Last updated info */}
      {data?.lastUpdated && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Bijgewerkt{" "}
            {formatDistanceToNow(new Date(data.lastUpdated), {
              addSuffix: true,
              locale: nl,
            })}
            {data.fromCache && " (cached)"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-6 px-2 text-xs"
          >
            {isFetching ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Vernieuwen"
            )}
          </Button>
        </div>
      )}

      {/* Events grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {events.slice(0, 10).map((event, index) => (
          <motion.a
            key={`${event.source}-${index}`}
            href={event.sourceUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
            className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 rounded-full p-2 shrink-0">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-foreground text-sm line-clamp-2 mb-1 group-hover:text-primary">
                  {event.title}
                </h3>
                {event.date && (
                  <p className="text-xs text-primary font-medium mb-1">
                    {event.date}
                  </p>
                )}
                {event.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {event.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  {event.source}
                </p>
              </div>
            </div>
          </motion.a>
        ))}
      </div>

      {events.length > 10 && (
        <p className="text-center text-sm text-muted-foreground">
          +{events.length - 10} meer events beschikbaar bij de bronnen
        </p>
      )}
    </div>
  );
}
