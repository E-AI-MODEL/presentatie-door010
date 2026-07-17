import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "list_my_appointments",
  title: "List my appointments",
  description:
    "List the signed-in user's appointments with an advisor, ordered by scheduled time.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (default 25)."),
    upcoming_only: z
      .boolean()
      .optional()
      .describe("If true, only return appointments in the future."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, upcoming_only }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = supabaseForUser(ctx)
      .from("appointments")
      .select("*")
      .eq("user_id", ctx.getUserId())
      .order("scheduled_at", { ascending: true })
      .limit(limit ?? 25);
    if (upcoming_only) q = q.gte("scheduled_at", new Date().toISOString());
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { appointments: data ?? [] },
    };
  },
});
