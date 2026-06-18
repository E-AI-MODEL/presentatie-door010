/**
 * Kleine totaal-functietest voor DOOR.
 * Run: bun scripts/smoketest-full.ts
 *
 * Blokken:
 *  1) Multi-login realtime sync (or1..or10 + or29)
 *  2) Kandidaat happy path (or1: profile update, doorai-chat, appointment insert)
 *  3) Backoffice actie (or29 -> or1: note + appointment confirm, kandidaat ontvangt)
 *  4) AI guardrails (sanitizer/forbidden patterns)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://euvisntlxhzlgdwxcndo.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1dmlzbnRseGh6bGdkd3hjbmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjQwNzcsImV4cCI6MjA5NDcwMDA3N30.GXvQJC0eLgGKrFbObXApgqfmNmHlhpsYRtVNDL5dPnA";
const PASSWORD = "onderwijs010";
const TAG = `smoke-${Date.now()}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pct = (arr: number[], p: number) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

type Session = {
  email: string;
  client: SupabaseClient;
  userId: string;
  accessToken: string;
  role: "candidate" | "advisor";
};

async function login(email: string, role: "candidate" | "advisor"): Promise<Session> {
  const client = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.user || !data.session) throw new Error(`login ${email}: ${error?.message}`);
  return { email, client, userId: data.user.id, accessToken: data.session.access_token, role };
}

// Track results
const results: Record<string, { pass: boolean; detail: string }> = {};

// ─────────────────────────────────────────────────────────────────────
// BLOK 1: Multi-login realtime sync
// ─────────────────────────────────────────────────────────────────────
async function blok1(): Promise<{ sessions: Session[]; cleanup: { appts: string[]; notes: string[] } }> {
  console.log(`\n━━━ [BLOK 1] Multi-login realtime sync ━━━`);
  const t0 = Date.now();
  const candidateEmails = Array.from({ length: 10 }, (_, i) => `or${i + 1}@doorai.nl`);
  const sessions = await Promise.all([
    ...candidateEmails.map((e) => login(e, "candidate")),
    login("or29@doorai.nl", "advisor"),
  ]);
  console.log(`  logged in 11 sessions in ${Date.now() - t0}ms`);

  type Hit = { table: string; t: number };
  const inbox = new Map<string, Hit[]>();
  sessions.forEach((s) => inbox.set(s.email, []));

  const subPromises: Promise<void>[] = [];
  for (const s of sessions) {
    if (s.role === "candidate") {
      const ch = s.client
        .channel(`u-${s.userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${s.userId}` },
          () => inbox.get(s.email)!.push({ table: "profiles", t: Date.now() }))
        .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `user_id=eq.${s.userId}` },
          () => inbox.get(s.email)!.push({ table: "appointments", t: Date.now() }));
      subPromises.push(new Promise((res, rej) => ch.subscribe((st) => {
        if (st === "SUBSCRIBED") res();
        if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") rej(new Error(st));
      })));
    } else {
      const ch = s.client.channel(`backoffice-${s.userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" },
          () => inbox.get(s.email)!.push({ table: "profiles", t: Date.now() }))
        .on("postgres_changes", { event: "*", schema: "public", table: "appointments" },
          () => inbox.get(s.email)!.push({ table: "appointments", t: Date.now() }))
        .on("postgres_changes", { event: "*", schema: "public", table: "advisor_notes" },
          () => inbox.get(s.email)!.push({ table: "advisor_notes", t: Date.now() }));
      subPromises.push(new Promise((res, rej) => ch.subscribe((st) => {
        if (st === "SUBSCRIBED") res();
        if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") rej(new Error(st));
      })));
    }
  }
  await Promise.all(subPromises);
  await sleep(800);

  const candidates = sessions.filter((s) => s.role === "candidate");
  const advisor = sessions.find((s) => s.role === "advisor")!;
  const writeStamps: { kind: string; sentAt: number; owner: string }[] = [];
  const apptIds: string[] = [];
  const noteIds: string[] = [];

  for (const s of candidates) {
    const t = Date.now();
    const [, apptR, noteR] = await Promise.all([
      s.client.from("profiles").update({ bio: `${TAG} ${t}` }).eq("user_id", s.userId),
      s.client.from("appointments").insert({ user_id: s.userId, subject: `${TAG}`, message: "loadtest", status: "pending" }).select("id").single(),
      advisor.client.from("advisor_notes").insert({ advisor_user_id: advisor.userId, candidate_user_id: s.userId, content: `${TAG}` }).select("id").single(),
    ]);
    if (apptR.data?.id) apptIds.push(apptR.data.id);
    if (noteR.data?.id) noteIds.push(noteR.data.id);
    writeStamps.push({ kind: "profiles", sentAt: t, owner: s.email });
    writeStamps.push({ kind: "appointments", sentAt: t, owner: s.email });
    writeStamps.push({ kind: "advisor_notes", sentAt: t, owner: s.email });
    await sleep(400);
  }
  await sleep(4000);

  let missed = 0;
  const lat: number[] = [];
  for (const s of sessions) {
    const hits = inbox.get(s.email)!;
    if (s.role === "candidate") {
      const ownStamps = writeStamps.filter((w) => w.owner === s.email);
      for (const w of ownStamps.filter((x) => x.kind !== "advisor_notes")) {
        const h = hits.find((x) => x.table === w.kind && x.t >= w.sentAt);
        if (h) lat.push(h.t - w.sentAt); else missed++;
      }
    } else {
      for (const w of writeStamps) {
        const h = hits.find((x) => x.table === w.kind && x.t >= w.sentAt);
        if (h) lat.push(h.t - w.sentAt); else missed++;
      }
    }
  }
  const p95 = pct(lat, 95);
  const pass = missed === 0 && p95 < 2000;
  results.blok1 = { pass, detail: `missed=${missed} p95=${Math.round(p95)}ms recv=${lat.length}` };
  console.log(`  ${pass ? "✅" : "❌"} ${results.blok1.detail}`);

  return { sessions, cleanup: { appts: apptIds, notes: noteIds } };
}

// ─────────────────────────────────────────────────────────────────────
// BLOK 2: Kandidaat happy path (or1)
// ─────────────────────────────────────────────────────────────────────
async function blok2(or1: Session): Promise<{ apptId?: string }> {
  console.log(`\n━━━ [BLOK 2] Kandidaat happy path (or1) ━━━`);
  const steps: string[] = [];
  let apptId: string | undefined;

  // Step 1: profile update
  const { error: pe } = await or1.client.from("profiles")
    .update({ bio: `${TAG} happy path` }).eq("user_id", or1.userId);
  steps.push(pe ? `profile❌(${pe.message})` : "profile✅");

  // Step 2: doorai-chat call (streaming SSE)
  let chatOk = false;
  let chatBody = "";
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/doorai-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${or1.accessToken}`,
        apikey: ANON,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hoi, ik wil graag meer weten over werken in het onderwijs" }],
        mode: "authenticated",
      }),
    });
    chatOk = r.ok;
    chatBody = await r.text();
  } catch (e) {
    chatBody = String(e);
  }
  steps.push(chatOk && chatBody.length > 50 ? "chat✅" : `chat❌(${chatOk ? "empty" : chatBody.slice(0, 60)})`);

  // Step 3: appointment insert
  const { data: ad, error: ae } = await or1.client.from("appointments")
    .insert({ user_id: or1.userId, subject: `${TAG} happy`, message: "kandidaat vraagt", status: "pending" })
    .select("id").single();
  apptId = ad?.id;
  steps.push(ae ? `appt❌(${ae.message})` : "appt✅");

  const pass = steps.every((s) => s.endsWith("✅"));
  results.blok2 = { pass, detail: steps.join(" ") };
  // Stash chat body for blok 4
  (globalThis as any).__chatBody = chatBody;
  console.log(`  ${pass ? "✅" : "❌"} ${results.blok2.detail}`);
  return { apptId };
}

// ─────────────────────────────────────────────────────────────────────
// BLOK 3: Backoffice actie or29 → or1
// ─────────────────────────────────────────────────────────────────────
async function blok3(or1: Session, advisor: Session, apptId?: string) {
  console.log(`\n━━━ [BLOK 3] Backoffice actie (or29 → or1) ━━━`);
  const inbox: { table: string; t: number }[] = [];
  const ch = or1.client.channel(`b3-${or1.userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `user_id=eq.${or1.userId}` },
      () => inbox.push({ table: "appointments", t: Date.now() }))
    .on("postgres_changes", { event: "*", schema: "public", table: "advisor_notes", filter: `candidate_user_id=eq.${or1.userId}` },
      () => inbox.push({ table: "advisor_notes", t: Date.now() }));
  await new Promise<void>((res, rej) => ch.subscribe((st) => {
    if (st === "SUBSCRIBED") res();
    if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") rej(new Error(st));
  }));
  await sleep(500);

  const sentAt = Date.now();
  const { data: nd, error: ne } = await advisor.client.from("advisor_notes")
    .insert({ advisor_user_id: advisor.userId, candidate_user_id: or1.userId, content: `${TAG} b3 note` })
    .select("id").single();
  let updErr: string | null = null;
  if (apptId) {
    const { error } = await advisor.client.from("appointments").update({ status: "confirmed" }).eq("id", apptId);
    if (error) updErr = error.message;
  }
  await sleep(2500);
  await or1.client.removeChannel(ch);

  // Note: advisor_notes have RLS scoped to advisors only — candidate kan ze niet zien.
  // We toetsen daarom alleen of de appointment-update bij de kandidaat binnenkomt.
  const apptHit = apptId ? inbox.find((h) => h.table === "appointments" && h.t >= sentAt - 100) : null;
  const apptLat = apptHit ? Math.max(0, apptHit.t - sentAt) : -1;
  const pass = !ne && !updErr && (!apptId || (!!apptHit && apptLat < 2000));
  results.blok3 = {
    pass,
    detail: `appt=${apptHit ? `${apptLat}ms` : (apptId ? "MISS" : "n/a")} noteWrite=${ne ? "❌" : "✅"}${ne ? `(${ne.message})` : ""}${updErr ? ` updErr=${updErr}` : ""}`,
  };
  if (nd?.id) await advisor.client.from("advisor_notes").delete().eq("id", nd.id);
  console.log(`  ${pass ? "✅" : "❌"} ${results.blok3.detail}`);
}

// ─────────────────────────────────────────────────────────────────────
// BLOK 4: AI guardrails (op chat response uit blok 2)
// ─────────────────────────────────────────────────────────────────────
function blok4() {
  console.log(`\n━━━ [BLOK 4] AI guardrails sanity ━━━`);
  const body: string = (globalThis as any).__chatBody ?? "";
  // Extract text deltas uit SSE stream
  const text = body
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim())
    .join(" ")
    .toLowerCase();

  const forbidden = ["fase", "intake", "detector", "peildatum", "kennisbank", "scenario"];
  const paths = ["/dashboard", "/profile", "/auth", "/backoffice", "/opleidingen", "/vacatures", "/events", "/kennisbank"];
  const hits: string[] = [];
  for (const w of forbidden) if (new RegExp(`\\b${w}\\b`).test(text)) hits.push(`term:${w}`);
  for (const p of paths) if (text.includes(p)) hits.push(`path:${p}`);
  // em-dash check (— U+2014)
  if (/—/.test(body)) hits.push("em-dash");
  // emoji check (basic)
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(body)) hits.push("emoji");

  const pass = hits.length === 0 && text.length > 0;
  results.blok4 = { pass, detail: hits.length ? `violations: ${hits.join(", ")}` : `clean (${text.length} chars scanned)` };
  console.log(`  ${pass ? "✅" : "❌"} ${results.blok4.detail}`);
}

// ─────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[${TAG}] starting smoketest`);
  const b1 = await blok1();
  const or1 = b1.sessions.find((s) => s.email === "or1@doorai.nl")!;
  const advisor = b1.sessions.find((s) => s.role === "advisor")!;

  const b2 = await blok2(or1);
  await blok3(or1, advisor, b2.apptId);
  blok4();

  // Cleanup
  console.log(`\n[${TAG}] cleanup ...`);
  if (b1.cleanup.appts.length) await advisor.client.from("appointments").delete().in("id", b1.cleanup.appts);
  if (b1.cleanup.notes.length) await advisor.client.from("advisor_notes").delete().in("id", b1.cleanup.notes);
  if (b2.apptId) await advisor.client.from("appointments").delete().eq("id", b2.apptId);

  for (const s of b1.sessions) {
    await s.client.removeAllChannels();
    await s.client.auth.signOut();
  }

  // Summary
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`SAMENVATTING`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  for (const [k, v] of Object.entries(results)) {
    console.log(`  ${v.pass ? "✅" : "❌"} ${k}: ${v.detail}`);
  }
  const allPass = Object.values(results).every((r) => r.pass);
  console.log(`\nOVERALL: ${allPass ? "✅ PASS" : "❌ FAIL"}\n`);
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
