import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface EventSource {
  url: string;
  name: string;
}

// Rotterdam-focused event sources
const EVENT_SOURCES: EventSource[] = [
  { url: "https://www.onderwijsloketrotterdam.nl/activiteiten", name: "Onderwijsloket Rotterdam" },
  { url: "https://www.onderwijs010.nl/activiteiten", name: "Onderwijs010" },
  { url: "https://www.onderwijsloket.com/activiteiten", name: "Landelijk Onderwijsloket" },
];

async function scrapeUrl(url: string, apiKey: string): Promise<any> {
  console.log(`Scraping ${url}...`);
  
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Scrape failed for ${url}:`, error);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
}

function extractEventsFromMarkdown(markdown: string, sourceName: string): any[] {
  const events: any[] = [];
  
  // Split by common event patterns
  const lines = markdown.split('\n');
  let currentEvent: any = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Look for date patterns (Dutch format)
    const datePatterns = [
      /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
      /(\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4})/i,
      /(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i,
    ];
    
    let hasDate = false;
    let dateStr = '';
    for (const pattern of datePatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        hasDate = true;
        dateStr = match[0];
        break;
      }
    }
    
    // Look for headers that might be event titles
    if (trimmed.startsWith('#') || trimmed.startsWith('**') || hasDate) {
      if (currentEvent && currentEvent.title) {
        events.push(currentEvent);
      }
      
      const title = trimmed
        .replace(/^#+\s*/, '')
        .replace(/^\*\*/, '')
        .replace(/\*\*$/, '')
        .trim();
      
      if (title.length > 5 && title.length < 200) {
        currentEvent = {
          title,
          date: dateStr || null,
          source: sourceName,
          description: '',
        };
      }
    } else if (currentEvent && trimmed.length > 10) {
      // Add to description
      if (currentEvent.description.length < 500) {
        currentEvent.description += (currentEvent.description ? ' ' : '') + trimmed;
      }
    }
  }
  
  if (currentEvent && currentEvent.title) {
    events.push(currentEvent);
  }
  
  // Filter to likely events
  const eventKeywords = ['open dag', 'webinar', 'meeloop', 'informatie', 'bijeenkomst', 'workshop', 'training', 'oriëntatie', 'kennismaking'];
  
  return events.filter(e => {
    const text = (e.title + ' ' + e.description).toLowerCase();
    return eventKeywords.some(kw => text.includes(kw)) || e.date;
  }).slice(0, 20); // Max 20 events per source
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check which sources need refreshing (expired or missing)
    const { data: existingData } = await supabase
      .from('scraped_events')
      .select('source_url, expires_at')
      .gt('expires_at', new Date().toISOString());

    const cachedUrls = new Set(existingData?.map(d => d.source_url) || []);
    const sourcesToScrape = EVENT_SOURCES.filter(s => !cachedUrls.has(s.url));

    console.log(`Found ${sourcesToScrape.length} sources to scrape, ${cachedUrls.size} still cached`);

    if (sourcesToScrape.length === 0) {
      // Return cached data
      const { data: cachedEvents } = await supabase
        .from('scraped_events')
        .select('*')
        .gt('expires_at', new Date().toISOString());

      return new Response(
        JSON.stringify({ 
          success: true, 
          cached: true,
          events: cachedEvents || [],
          message: 'Returning cached data'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Scrape sources that need updating
    const results: any[] = [];

    for (const source of sourcesToScrape) {
      const scrapeResult = await scrapeUrl(source.url, firecrawlKey);
      
      if (scrapeResult?.success && scrapeResult?.data?.markdown) {
        const extractedEvents = extractEventsFromMarkdown(scrapeResult.data.markdown, source.name);
        
        // Upsert to database
        const { error: upsertError } = await supabase
          .from('scraped_events')
          .upsert({
            source_url: source.url,
            source_name: source.name,
            events_data: extractedEvents,
            scraped_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
          }, {
            onConflict: 'source_url'
          });

        if (upsertError) {
          console.error('Upsert error:', upsertError);
        } else {
          results.push({
            source: source.name,
            eventsCount: extractedEvents.length,
          });
        }
      } else {
        console.log(`No data scraped from ${source.name}`);
      }
      
      // Small delay between requests
      await new Promise(r => setTimeout(r, 500));
    }

    // Get all current events
    const { data: allEvents } = await supabase
      .from('scraped_events')
      .select('*')
      .gt('expires_at', new Date().toISOString());

    return new Response(
      JSON.stringify({ 
        success: true, 
        cached: false,
        scraped: results,
        events: allEvents || [],
        message: `Scraped ${results.length} sources`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in scrape-events:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
