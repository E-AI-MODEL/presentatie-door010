/**
 * Headless realtime loadtest:
 * - Logs in or1..or10 (candidates) + or29 (advisor) in parallel
 * - Subscribes per-user channels (profiles+appointments) and advisor backoffice channels
 * - Triggers writes (profile update + appointment insert per candidate, advisor_note per pair)
 * - Measures realtime fan-out latency and missed events
 *
 * Run: bun scripts/loadtest-realtime.ts
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://euvisntlxhzlgdwxcndo.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1dmlzbnRseGh6bGdkd3hjbmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjQwNzcsImV4cCI6MjA5NDcwMDA3N30.GXvQJC0eLgGKrFbObXApgqfmNmHlhpsYRtVNDL5dPnA";
const PASSWORD = "onderwijs010";
const TAG = `loadtest-${Date.now()}`;

type Session = {
  email: string;
  client: SupabaseClient;
  userId: string;
  role: "candidate" | "advisor";
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pct = (arr: number[], p: number) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

async function login(email: string, role: "candidate" | "advisor"): Promise<Session> {
  const client = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.user) throw new Error(`login ${email}: ${error?.message}`);
  return { email, client, userId: data.user.id, role };
}

type Hit = { table: string; t: number };

async function main() {
  const t0 = Date.now();
  console.log(`[${TAG}] logging in 11 sessions in parallel ...`);
  const candidateEmails = Array.from({ length: 10 }, (_, i) => `or${i + 1}@doorai.nl`);
  const sessions = await Promise.all([
    ...candidateEmails.map((e) => login(e, "candidate")),
    login("or29@doorai.nl", "advisor"),
  ]);
  console.log(`  ok in ${Date.now() - t0}ms`);

  // Per-session inbox of received realtime events
  const inbox = new Map<string, Hit[]>();
  sessions.forEach((s) => inbox.set(s.email, []));

  // Subscribe candidates: profile + appointments scoped to own user_id
  const subPromises: Promise<void>[] = [];
  for (const s of sessions) {
    if (s.role === "candidate") {
      const ch = s.client
        .channel(`u-${s.userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${s.userId}` },
          () => inbox.get(s.email)!.push({ table: "profiles", t: Date.now() }),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "appointments", filter: `user_id=eq.${s.userId}` },
          () => inbox.get(s.email)!.push({ table: "appointments", t: Date.now() }),
        );
      subPromises.push(
        new Promise<void>((resolve, reject) => {
          ch.subscribe((status) => {
            if (status === "SUBSCRIBED") resolve();
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(status));
          });
        }),
      );
    } else {
      // Advisor: backoffice-wide channels (no filter), like src/pages/Backoffice.tsx
      const ch = s.client
        .channel(`backoffice-${s.userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "profiles" },
          () => inbox.get(s.email)!.push({ table: "profiles", t: Date.now() }),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "appointments" },
          () => inbox.get(s.email)!.push({ table: "appointments", t: Date.now() }),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "advisor_notes" },
          () => inbox.get(s.email)!.push({ table: "advisor_notes", t: Date.now() }),
        );
      subPromises.push(
        new Promise<void>((resolve, reject) => {
          ch.subscribe((status) => {
            if (status === "SUBSCRIBED") resolve();
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(status));
          });
        }),
      );
    }
  }
  await Promise.all(subPromises);
  console.log(`[${TAG}] all 11 channels SUBSCRIBED in ${Date.now() - t0}ms`);

  // Small settle delay so Realtime backend wires filters
  await sleep(800);

  // ---- Trigger writes, spread over ~6s ----
  const candidates = sessions.filter((s) => s.role === "candidate");
  const advisor = sessions.find((s) => s.role === "advisor")!;
  const writeStamps: { kind: string; sentAt: number; ownerEmail: string }[] = [];
  const createdAppointments: string[] = [];
  const createdNotes: string[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const s = candidates[i];
    const ownStamp = Date.now();
    // 1) Profile update
    const profP = s.client
      .from("profiles")
      .update({ bio: `${TAG} bio update ${ownStamp}` })
      .eq("user_id", s.userId)
      .then(({ error }) => {
        if (error) console.error(`profiles update ${s.email}:`, error.message);
      });
    writeStamps.push({ kind: "profiles", sentAt: ownStamp, ownerEmail: s.email });

    // 2) Appointment insert
    const apptStamp = Date.now();
    const apptP = s.client
      .from("appointments")
      .insert({
        user_id: s.userId,
        subject: `${TAG} appt ${apptStamp}`,
        message: "loadtest",
        status: "pending",
      })
      .select("id")
      .single()
      .then(({ data, error }) => {
        if (error) console.error(`appt insert ${s.email}:`, error.message);
        else if (data?.id) createdAppointments.push(data.id);
      });
    writeStamps.push({ kind: "appointments", sentAt: apptStamp, ownerEmail: s.email });

    // 3) Advisor note (advisor writes about this candidate)
    const noteStamp = Date.now();
    const noteP = advisor.client
      .from("advisor_notes")
      .insert({
        advisor_user_id: advisor.userId,
        candidate_user_id: s.userId,
        content: `${TAG} note ${noteStamp}`,
      })
      .select("id")
      .single()
      .then(({ data, error }) => {
        if (error) console.error(`note insert for ${s.email}:`, error.message);
        else if (data?.id) createdNotes.push(data.id);
      });
    writeStamps.push({ kind: "advisor_notes", sentAt: noteStamp, ownerEmail: s.email });

    await Promise.all([profP, apptP, noteP]);
    await sleep(500); // spread writes
  }

  console.log(`[${TAG}] writes done, waiting 4s for realtime fanout ...`);
  await sleep(4000);

  // ---- Compute results ----
  // Expected per session:
  //  candidate: 2 events (profiles own + appointments own)
  //  advisor:   30 events (10 profile updates + 10 appt inserts + 10 note inserts)
  const sentByOwner = new Map<string, { profiles: number; appointments: number }>();
  for (const w of writeStamps) {
    const cur = sentByOwner.get(w.ownerEmail) ?? { profiles: 0, appointments: 0 };
    if (w.kind === "profiles") cur.profiles = w.sentAt;
    if (w.kind === "appointments") cur.appointments = w.sentAt;
    sentByOwner.set(w.ownerEmail, cur);
  }

  const rows: string[] = [];
  rows.push(
    [
      "session".padEnd(22),
      "role".padEnd(10),
      "expect",
      "recv",
      "p50_ms",
      "p95_ms",
      "max_ms",
    ].join("  "),
  );
  let totalMissed = 0;
  let allLatencies: number[] = [];

  for (const s of sessions) {
    const hits = inbox.get(s.email)!;
    let expected = 0;
    const latencies: number[] = [];

    if (s.role === "candidate") {
      const own = sentByOwner.get(s.email)!;
      expected = 2;
      // earliest matching hit per table
      const profHit = hits.find((h) => h.table === "profiles");
      const apptHit = hits.find((h) => h.table === "appointments");
      if (profHit) latencies.push(profHit.t - own.profiles);
      if (apptHit) latencies.push(apptHit.t - own.appointments);
    } else {
      expected = 30; // 10 profiles + 10 appointments + 10 advisor_notes
      // For each write, find first hit on advisor inbox after sentAt with matching table
      for (const w of writeStamps) {
        const h = hits.find((x) => x.table === w.kind && x.t >= w.sentAt);
        if (h) latencies.push(h.t - w.sentAt);
      }
    }
    const received = latencies.length;
    totalMissed += expected - received;
    allLatencies.push(...latencies);
    rows.push(
      [
        s.email.padEnd(22),
        s.role.padEnd(10),
        String(expected).padStart(6),
        String(received).padStart(4),
        String(Math.round(pct(latencies, 50) || 0)).padStart(6),
        String(Math.round(pct(latencies, 95) || 0)).padStart(6),
        String(latencies.length ? Math.max(...latencies) : 0).padStart(6),
      ].join("  "),
    );
  }

  console.log("\n" + rows.join("\n") + "\n");
  console.log(
    `OVERALL: missed=${totalMissed}, p50=${Math.round(pct(allLatencies, 50))}ms, p95=${Math.round(pct(allLatencies, 95))}ms, max=${allLatencies.length ? Math.max(...allLatencies) : 0}ms`,
  );
  const pass = totalMissed === 0 && pct(allLatencies, 95) < 2000;
  console.log(pass ? "RESULT: ✅ PASS" : "RESULT: ❌ FAIL");

  // ---- Cleanup ----
  console.log(`\n[${TAG}] cleaning up test data ...`);
  if (createdAppointments.length) {
    const { error } = await advisor.client.from("appointments").delete().in("id", createdAppointments);
    if (error) console.error("cleanup appts:", error.message);
  }
  if (createdNotes.length) {
    const { error } = await advisor.client.from("advisor_notes").delete().in("id", createdNotes);
    if (error) console.error("cleanup notes:", error.message);
  }

  // Tear down
  for (const s of sessions) {
    await s.client.removeAllChannels();
    await s.client.auth.signOut();
  }
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
