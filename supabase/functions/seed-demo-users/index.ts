// Edge function: seed 30 demo accounts (or1@..or30@doorai.nl)
// Admin-only. Idempotent: skips existing users, updates their profile/role.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const DEMO_PASSWORD = "onderwijs010";

type Persona = {
  first_name: string;
  last_name: string;
  current_phase: "interesseren" | "orienteren" | "beslissen" | "matchen" | "voorbereiden";
  preferred_sector: string;
  bio: string;
};

const PHASES: Persona["current_phase"][] = [
  "interesseren", "orienteren", "beslissen", "matchen", "voorbereiden",
];
const SECTORS = [
  "Zorg", "Techniek", "ICT", "Onderwijs", "Horeca",
  "Logistiek", "Creatief", "Ondernemen",
];
const FIRST_NAMES = [
  "Yusuf", "Fatima", "Daan", "Sanne", "Mehmet", "Aisha", "Lars", "Noa",
  "Mohamed", "Sara", "Tim", "Emma", "Khalid", "Lotte", "Sven", "Maya",
  "Bilal", "Iris", "Jens", "Amira", "Stijn", "Zoë", "Hassan", "Eva",
  "Mats", "Layla", "Finn", "Yara", "Anouk", "Rayan",
];
const LAST_NAMES = [
  "el Amrani", "de Vries", "Janssen", "Bakker", "Yilmaz", "Kaya", "van Dijk",
  "Visser", "Mahmoud", "Smit", "de Jong", "Hassan", "Kuipers", "El Idrissi",
  "Mulder", "Bos", "Demir", "Peters", "van der Berg", "Hendriks",
  "Karim", "Vermeer", "Çelik", "Brouwer", "Aydın", "de Boer", "Said",
  "Willems", "van Leeuwen", "Öztürk",
];

function buildPersona(i: number): Persona {
  return {
    first_name: FIRST_NAMES[i % FIRST_NAMES.length],
    last_name: LAST_NAMES[i % LAST_NAMES.length],
    current_phase: PHASES[i % PHASES.length],
    preferred_sector: SECTORS[i % SECTORS.length],
    bio: `Demo-account or${i + 1}. Persona uit Rotterdam.`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ---- AUTH: admin only ----
    const authHeader = req.headers.get("Authorization") ?? "";
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    let authorized = false;
    if (authHeader) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: isAdminRow } = await admin
          .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
        if (isAdminRow) authorized = true;
      }
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "forbidden: admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- SEED ----
    const results: Array<{ email: string; status: string; user_id?: string }> = [];

    for (let i = 0; i < 30; i++) {
      const num = i + 1;
      const email = `or${num}@doorai.nl`;
      const persona = buildPersona(i);
      // 28 candidate (1..28) + 2 advisor (29, 30)
      const role: "candidate" | "advisor" = num >= 29 ? "advisor" : "candidate";

      let userId: string | null = null;

      // Try create
      const { data: created, error: cerr } = await admin.auth.admin.createUser({
        email,
        password: DEMO_PASSWORD,
        email_confirm: true,
      });

      if (cerr) {
        // Likely already exists → look up via listUsers (paginated search)
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const found = list?.users.find((u) => u.email?.toLowerCase() === email);
        if (!found) {
          results.push({ email, status: `error: ${cerr.message}` });
          continue;
        }
        userId = found.id;
        results.push({ email, status: "exists", user_id: userId });
      } else {
        userId = created.user?.id ?? null;
        results.push({ email, status: "created", user_id: userId ?? undefined });
      }

      if (!userId) continue;

      // Upsert profile (no trigger present → always upsert)
      await admin.from("profiles").upsert({
        user_id: userId,
        first_name: persona.first_name,
        last_name: persona.last_name,
        current_phase: persona.current_phase,
        preferred_sector: persona.preferred_sector,
        bio: persona.bio,
      }, { onConflict: "user_id" });

      // Ensure correct role (idempotent: clear then insert)
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("user_roles").insert({ user_id: userId, role });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
