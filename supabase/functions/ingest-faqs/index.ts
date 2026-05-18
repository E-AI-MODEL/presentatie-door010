import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FaqInput {
  question: string;
  answer: string;
  category?: string;
  tags?: string[];
  peildatum?: string;
  source_url?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { faqs, mode = "upsert" }: { faqs: FaqInput[]; mode?: "upsert" | "replace" } = await req.json();

    if (!Array.isArray(faqs) || faqs.length === 0) {
      return new Response(JSON.stringify({ error: "faqs array is required and must not be empty" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate
    for (let i = 0; i < faqs.length; i++) {
      if (!faqs[i].question || !faqs[i].answer) {
        return new Response(JSON.stringify({ error: `FAQ at index ${i} missing question or answer` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // If replace mode, clear existing FAQs first
    if (mode === "replace") {
      const { error: deleteError } = await supabase.from("faq_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (deleteError) {
        console.error("Delete error:", deleteError);
        return new Response(JSON.stringify({ error: "Failed to clear existing FAQs" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Insert in batches of 50
    const batchSize = 50;
    let inserted = 0;
    let errors: string[] = [];

    for (let i = 0; i < faqs.length; i += batchSize) {
      const batch = faqs.slice(i, i + batchSize).map((faq) => ({
        question: faq.question,
        answer: faq.answer,
        category: faq.category || "algemeen",
        tags: faq.tags || [],
        peildatum: faq.peildatum || null,
        source_url: faq.source_url || null,
      }));

      const { data, error } = await supabase.from("faq_items").insert(batch).select("id");

      if (error) {
        console.error(`Batch ${i / batchSize} error:`, error);
        errors.push(`Batch ${i / batchSize}: ${error.message}`);
      } else {
        inserted += data.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted,
        total: faqs.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Ingest error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
