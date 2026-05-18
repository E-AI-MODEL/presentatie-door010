import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ScrapedEvent {
  title: string;
  date: string | null;
  source: string;
  sourceUrl: string;
  description: string;
}

interface ScrapedEventsData {
  id: string;
  source_url: string;
  source_name: string;
  events_data: ScrapedEvent[];
  scraped_at: string;
  expires_at: string;
}

export function useScrapedEvents() {
  return useQuery({
    queryKey: ["scraped-events"],
    queryFn: async () => {
      // First check for cached data
      const { data: cached, error: cacheError } = await supabase
        .from("scraped_events")
        .select("*")
        .gt("expires_at", new Date().toISOString());

      if (cacheError) {
        console.error("Error fetching cached events:", cacheError);
      }

      // If we have fresh cached data, return it
      if (cached && cached.length > 0) {
        // Flatten all events from all sources, adding source URL
        const allEvents: ScrapedEvent[] = [];
        for (const source of cached as unknown as ScrapedEventsData[]) {
          if (Array.isArray(source.events_data)) {
            allEvents.push(...source.events_data.map(event => ({
              ...event,
              sourceUrl: source.source_url,
            })));
          }
        }
        return {
          events: allEvents,
          sources: cached as unknown as ScrapedEventsData[],
          lastUpdated: cached[0]?.scraped_at,
          fromCache: true,
        };
      }

      // No cache, trigger scraping
      const { data: scrapeResult, error: scrapeError } = await supabase.functions.invoke(
        "scrape-events"
      );

      if (scrapeError) {
        console.error("Error triggering scrape:", scrapeError);
        return {
          events: [],
          sources: [],
          lastUpdated: null,
          fromCache: false,
          error: scrapeError.message,
        };
      }

      // Extract events from scrape result, adding source URL
      const allEvents: ScrapedEvent[] = [];
      if (scrapeResult?.events) {
        for (const source of scrapeResult.events) {
          if (Array.isArray(source.events_data)) {
            allEvents.push(...source.events_data.map((event: any) => ({
              ...event,
              sourceUrl: source.source_url,
            })));
          }
        }
      }

      return {
        events: allEvents,
        sources: scrapeResult?.events || [],
        lastUpdated: new Date().toISOString(),
        fromCache: false,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
