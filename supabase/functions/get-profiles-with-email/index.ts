import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user has advisor/admin role
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roleData, error: roleError } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (roleError || !roleData || roleData.length === 0) {
      return new Response(
        JSON.stringify({ error: "User role not found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const roles = roleData.map(r => r.role);
    if (!roles.includes("advisor") && !roles.includes("admin")) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to fetch all data
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch profiles, conversations, auth users, appointments, saved_events, saved_vacancies, user_notes in parallel
    const [profilesResult, conversationsResult, usersResult, appointmentsResult, savedEventsResult, savedVacanciesResult, userNotesResult] = await Promise.all([
      adminClient.from("profiles").select("*").order("created_at", { ascending: false }),
      adminClient.from("conversations").select("id, user_id, updated_at"),
      adminClient.auth.admin.listUsers({ perPage: 1000 }),
      adminClient.from("appointments").select("*").order("created_at", { ascending: false }),
      adminClient.from("saved_events").select("*"),
      adminClient.from("saved_vacancies").select("*"),
      adminClient.from("user_notes").select("*"),
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (conversationsResult.error) throw conversationsResult.error;
    if (usersResult.error) throw usersResult.error;

    const profiles = profilesResult.data || [];
    const conversations = conversationsResult.data || [];
    const users = usersResult.data?.users || [];
    const appointments = appointmentsResult.data || [];
    const savedEvents = savedEventsResult.data || [];
    const savedVacancies = savedVacanciesResult.data || [];
    const userNotes = userNotesResult.data || [];

    // Get the latest message date per conversation + unread calculation
    const conversationIds = conversations.map(c => c.id);
    let lastMessageMap: Record<string, string> = {};
    let unreadMap: Record<string, number> = {};
    
    if (conversationIds.length > 0) {
      const { data: messagesData } = await adminClient
        .from("messages")
        .select("conversation_id, created_at, role")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false });

      if (messagesData) {
        const convToUser: Record<string, string> = {};
        conversations.forEach(c => { convToUser[c.id] = c.user_id; });

        // Track last message per user and calculate unread
        const lastAdvisorMsg: Record<string, string> = {};
        
        for (const msg of messagesData) {
          const usrId = convToUser[msg.conversation_id];
          if (!usrId) continue;
          
          // Last message timestamp (any role)
          if (!lastMessageMap[usrId]) {
            lastMessageMap[usrId] = msg.created_at;
          }
          
          // Track last advisor message per user
          if (msg.role === 'advisor' && !lastAdvisorMsg[usrId]) {
            lastAdvisorMsg[usrId] = msg.created_at;
          }
        }

        // Count user/assistant messages after last advisor message
        for (const msg of messagesData) {
          const usrId = convToUser[msg.conversation_id];
          if (!usrId) continue;
          if (msg.role === 'advisor') continue;
          if (msg.role !== 'user') continue; // Only count user messages as "unread"
          
          const lastAdv = lastAdvisorMsg[usrId];
          if (!lastAdv || msg.created_at > lastAdv) {
            unreadMap[usrId] = (unreadMap[usrId] || 0) + 1;
          }
        }
      }
    }

    // Build conversation count per user
    const convCountMap: Record<string, number> = {};
    conversations.forEach(c => {
      convCountMap[c.user_id] = (convCountMap[c.user_id] || 0) + 1;
    });

    // Build appointments per user
    const appointmentsMap: Record<string, typeof appointments> = {};
    appointments.forEach(a => {
      if (!appointmentsMap[a.user_id]) appointmentsMap[a.user_id] = [];
      appointmentsMap[a.user_id].push(a);
    });

    // Build saved events per user
    const savedEventsMap: Record<string, typeof savedEvents> = {};
    savedEvents.forEach(e => {
      if (!savedEventsMap[e.user_id]) savedEventsMap[e.user_id] = [];
      savedEventsMap[e.user_id].push(e);
    });

    // Build saved vacancies per user
    const savedVacanciesMap: Record<string, typeof savedVacancies> = {};
    savedVacancies.forEach(v => {
      if (!savedVacanciesMap[v.user_id]) savedVacanciesMap[v.user_id] = [];
      savedVacanciesMap[v.user_id].push(v);
    });

    // Build notes per user
    const notesMap: Record<string, typeof userNotes> = {};
    userNotes.forEach(n => {
      if (!notesMap[n.user_id]) notesMap[n.user_id] = [];
      notesMap[n.user_id].push(n);
    });

    // Email map
    const emailMap: Record<string, string> = {};
    users.forEach(u => {
      emailMap[u.id] = u.email || "";
    });

    // Combine everything
    const profilesWithEmail = profiles.map(profile => ({
      ...profile,
      email: emailMap[profile.user_id] || null,
      conversation_count: convCountMap[profile.user_id] || 0,
      last_message_at: lastMessageMap[profile.user_id] || null,
      unread_messages: unreadMap[profile.user_id] || 0,
      appointments: appointmentsMap[profile.user_id] || [],
      saved_events: savedEventsMap[profile.user_id] || [],
      saved_vacancies: savedVacanciesMap[profile.user_id] || [],
      user_notes: notesMap[profile.user_id] || [],
    }));

    return new Response(
      JSON.stringify({ profiles: profilesWithEmail }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching profiles with emails:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
