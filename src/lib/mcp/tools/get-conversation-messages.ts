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
  name: "get_conversation_messages",
  title: "Get conversation messages",
  description:
    "Fetch messages (role, content, created_at) from one of the signed-in user's DoorAI conversations. RLS restricts access to the user's own conversations.",
  inputSchema: {
    conversation_id: z.string().uuid().describe("Conversation id to fetch messages for."),
    limit: z.number().int().min(1).max(200).optional().describe("Max messages (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ conversation_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    // RLS still enforces ownership, but double-check for a clean error.
    const { data: conv, error: convErr } = await sb
      .from("conversations")
      .select("id")
      .eq("id", conversation_id)
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (convErr) return { content: [{ type: "text", text: convErr.message }], isError: true };
    if (!conv) {
      return {
        content: [{ type: "text", text: "Conversation not found for this user." }],
        isError: true,
      };
    }
    const { data, error } = await sb
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(limit ?? 50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { messages: data ?? [] },
    };
  },
});
