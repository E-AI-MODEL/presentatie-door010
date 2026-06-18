/**
 * AI stress test: 10 kandidaten loggen tegelijk in en sturen 1 chat-bericht
 * via doorai-chat (SSE). Meet succes, latency en assistant-text lengte.
 * Run: bun scripts/aistress-10.ts
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://euvisntlxhzlgdwxcndo.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1dmlzbnRseGh6bGdkd3hjbmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjQwNzcsImV4cCI6MjA5NDcwMDA3N30.GXvQJC0eLgGKrFbObXApgqfmNmHlhpsYRtVNDL5dPnA";
const PASSWORD = "onderwijs010";

const PROMPTS = [
  "Hoi, wat kan ik doen om in het onderwijs te starten?",
  "Welke opleidingen zijn er voor zorg?",
  "Hoe vind ik een stage in techniek?",
  "Ik twijfel tussen onderwijs en zorg, kun je helpen?",
  "Wat verdien je als zij-instromer in het onderwijs?",
  "Welke certificaten heb ik nodig voor de zorg?",
  "Kun je een afspraak met een adviseur plannen?",
  "Welke werkgevers zoeken nu mensen in Rotterdam?",
  "Hoe lang duurt een omscholing gemiddeld?",
  "Wat is de eerste stap die ik moet zetten?",
];

async function login(email: string) {
  const c = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw new Error(`${email}: ${error?.message}`);
  return { email, token: data.session.access_token, client: c };
}

function parseSSE(body: string) {
  const lines = body.split("\n");
  let inUi = false;
  let text = "";
  for (const line of lines) {
    if (line.startsWith("event:")) { inUi = !line.includes("event: message") && line.trim() !== "event:"; continue; }
    if (line.trim() === "") { inUi = false; continue; }
    if (!line.startsWith("data:") || inUi) continue;
    const p = line.slice(5).trim();
    if (p === "[DONE]" || !p) continue;
    try {
      const j = JSON.parse(p);
      const d = j?.choices?.[0]?.delta?.content ?? j?.choices?.[0]?.message?.content ?? "";
      if (typeof d === "string") text += d;
    } catch {}
  }
  return text;
}

async function callChat(token: string, prompt: string) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/doorai-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: ANON },
      body: JSON.stringify({ messages: [{ role: "user", content: prompt }], mode: "authenticated" }),
    });
    const body = await r.text();
    const text = parseSSE(body);
    return { ok: r.ok && text.length > 30, status: r.status, ms: Date.now() - t0, chars: text.length, text, body };
  } catch (e: any) {
    return { ok: false, status: 0, ms: Date.now() - t0, chars: 0, text: "", body: String(e?.message ?? e) };
  }
}

async function main() {
  console.log(`[aistress-10] Login 10 kandidaten ...`);
  const t0 = Date.now();
  const sessions = await Promise.all(Array.from({ length: 10 }, (_, i) => login(`or${i + 1}@doorai.nl`)));
  console.log(`  ✅ logged in 10 sessions in ${Date.now() - t0}ms`);

  console.log(`\n[aistress-10] 10 parallelle chat-calls ...`);
  const tStart = Date.now();
  const results = await Promise.all(sessions.map((s, i) => callChat(s.token, PROMPTS[i])));
  const totalMs = Date.now() - tStart;

  console.log(`\n━━━ Resultaten ━━━`);
  let ok = 0;
  results.forEach((r, i) => {
    const tag = r.ok ? "✅" : "❌";
    console.log(`  ${tag} or${i + 1} status=${r.status} ${r.ms}ms ${r.chars}ch${r.ok ? "" : ` body=${r.body.slice(0, 120)}`}`);
    if (r.ok) ok++;
  });

  const lats = results.filter((r) => r.ok).map((r) => r.ms).sort((a, b) => a - b);
  const p50 = lats[Math.floor(lats.length * 0.5)] ?? 0;
  const p95 = lats[Math.floor(lats.length * 0.95)] ?? 0;
  const avgChars = Math.round(results.reduce((s, r) => s + r.chars, 0) / results.length);

  // Guardrail check on alle responses
  const forbidden = ["fase", "intake", "detector", "peildatum", "kennisbank", "scenario"];
  const paths = ["/dashboard", "/profile", "/auth", "/backoffice", "/opleidingen", "/vacatures", "/events", "/kennisbank"];
  const violations: string[] = [];
  results.forEach((r, i) => {
    const lo = r.text.toLowerCase();
    for (const w of forbidden) if (new RegExp(`\\b${w}\\b`).test(lo)) violations.push(`or${i + 1}:term:${w}`);
    for (const p of paths) if (lo.includes(p)) violations.push(`or${i + 1}:path:${p}`);
    if (/—/.test(r.text)) violations.push(`or${i + 1}:em-dash`);
    if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(r.text)) violations.push(`or${i + 1}:emoji`);
  });

  console.log(`\n━━━ Samenvatting ━━━`);
  console.log(`  Succes:        ${ok}/10`);
  console.log(`  Wandkloktijd:  ${totalMs}ms (parallel)`);
  console.log(`  Latency p50:   ${p50}ms`);
  console.log(`  Latency p95:   ${p95}ms`);
  console.log(`  Avg response:  ${avgChars} chars`);
  console.log(`  Guardrails:    ${violations.length === 0 ? "✅ clean" : `❌ ${violations.length} (${violations.slice(0, 5).join(", ")})`}`);

  // Cleanup
  for (const s of sessions) await s.client.auth.signOut();

  const pass = ok === 10 && violations.length === 0;
  console.log(`\nOVERALL: ${pass ? "✅ PASS" : "❌ FAIL"}\n`);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(2); });
