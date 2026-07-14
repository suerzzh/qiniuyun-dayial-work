const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
const DATABASE_KEY = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ACCEPTED_PUBLIC_KEYS = new Set([
  ...Object.values(publishableKeys),
  Deno.env.get("SUPABASE_ANON_KEY") || "",
].filter(Boolean));
const MODEL = Deno.env.get("BAILIAN_MODEL") || "qwen3.5-omni-plus-realtime";
const LEVEL_LABELS: Record<number, string> = {
  1: "Starter (A1)", 2: "Basic (A2)", 3: "Intermediate (B1)",
  4: "CET-4 (B1-B2)", 5: "CET-6 (B2)", 6: "Advanced (C1)",
};

const COACH_PROMPT = `You are Clara, an AI English speaking coach for adult Chinese learners.
Speak mainly in natural conversational English. Keep replies to one or two short sentences and ask one question at a time. Adapt vocabulary and sentence structure to the saved learner level. Correct gently and only the most useful issue. If the learner mixes Chinese and English, first give one natural English expression, then continue without forcing repetition. Stay on the current topic unless the learner changes it. Remember earlier details and reuse them naturally. Never interrupt filler sounds or hesitation; wait patiently. At the start of a new call, greet briefly, choose one concrete daily topic, and ask one easy question. Vary the opening.
Output only words that should be spoken. Never use Markdown, lists, headings, decorative symbols, or long explanations. If the learner explicitly requests another language, answer directly in that language and native writing system, without an English introduction or follow-up. Your goal is confidence and more learner speaking time.`;

const allowedOrigins = new Set((Deno.env.get("ALLOWED_WEB_ORIGINS") || "")
  .split(",").map((value) => value.trim()).filter(Boolean));

function originAllowed(origin: string | null) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return allowedOrigins.has(origin) ||
      ((url.hostname === "localhost" || url.hostname === "127.0.0.1") && ["http:", "https:"].includes(url.protocol)) ||
      (url.protocol === "https:" && url.hostname.endsWith(".vercel.app"));
  } catch { return false; }
}

function cors(origin: string | null) {
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "apikey,content-type",
    "Access-Control-Max-Age": "600",
  };
}

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function database(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !DATABASE_KEY) throw new Error("Database credentials are unavailable");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: DATABASE_KEY,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("Database request failed", response.status, detail.slice(0, 300));
    throw new Error("Database operation failed");
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function clientHash(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const bytes = new TextEncoder().encode(`${forwarded}:unispeaking-web`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function consumeSessionLimit(hash: string) {
  const since = encodeURIComponent(new Date(Date.now() - 60_000).toISOString());
  const rows = await database(`request_rate_limits?client_hash=eq.${hash}&action=eq.session&created_at=gte.${since}&select=id&limit=6`) as unknown[];
  if (rows.length >= 5) return false;
  await database("request_rate_limits", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ client_hash: hash, action: "session" }),
  });
  return true;
}

function buildSessionConfig(level: number, label: string, prompt: string) {
  const focus = prompt ? `\n\nLesson focus: ${prompt}` : "";
  return {
    voice: "Tina",
    input_audio_format: "pcm",
    input_audio_transcription: { model: "qwen3-asr-flash-realtime" },
    instructions: `${COACH_PROMPT}\n\nThe learner's current level is ${level}: ${label}. Change difficulty only after a consistent pattern across at least three learner turns.${focus}`,
    modalities: ["text", "audio"],
    output_audio_format: "pcm",
    max_tokens: 128,
    temperature: 0.7,
    tools: [{
      type: "function",
      function: {
        name: "update_learner_level",
        description: "Update the saved learner level only after at least three turns show a consistent pattern.",
        parameters: {
          type: "object",
          properties: {
            requested_level: { type: "integer", minimum: 1, maximum: 6 },
            reason: { type: "string" },
          },
          required: ["requested_level", "reason"],
        },
      },
    }],
    turn_detection: { type: "server_vad", threshold: 0.5, prefix_padding_ms: 500, silence_duration_ms: 800 },
  };
}

async function findSession(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await database(`realtime_sessions?id=eq.${id}&select=id,conversation_id,status,expires_at&limit=1`) as Array<Record<string, string>>;
  const session = rows[0];
  if (!session || session.status !== "active" || Date.parse(session.expires_at) < Date.now()) return null;
  return session;
}

async function createSession(req: Request, origin: string | null) {
  const body = await req.json().catch(() => ({}));
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (prompt.length > 2000) return json({ error: "练习提示不能超过 2000 个字符" }, 400, origin);
  const hash = await clientHash(req);
  if (!await consumeSessionLimit(hash)) return json({ error: "开始次数过于频繁，请一分钟后再试" }, 429, origin);
  const suppliedId = typeof body.conversation_id === "string" ? body.conversation_id : "";
  const conversationId = /^[0-9a-f-]{36}$/i.test(suppliedId) ? suppliedId : crypto.randomUUID();
  const profileRows = await database("learner_profiles?on_conflict=conversation_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ conversation_id: conversationId }),
  }) as Array<{ level: number; label: string }>;
  const profile = profileRows[0] || { level: 4, label: LEVEL_LABELS[4] };
  const sessions = await database("realtime_sessions", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ conversation_id: conversationId, prompt, client_hash: hash }),
  }) as Array<{ id: string; created_at: string }>;
  const session = sessions[0];
  return json({
    session_id: session.id,
    conversation_id: conversationId,
    created_at: session.created_at,
    history: [],
    learner_profile: profile,
    session_config: buildSessionConfig(profile.level, profile.label, prompt),
  }, 201, origin);
}

async function exchangeSdp(req: Request, sessionId: string, origin: string | null) {
  if (!await findSession(sessionId)) return json({ error: "实时会话不存在或已过期" }, 404, origin);
  const apiKey = Deno.env.get("DASHSCOPE_API_KEY") || "";
  const workspace = Deno.env.get("BAILIAN_WORKSPACE_ID") || "";
  if (!apiKey || !/^[A-Za-z0-9_-]{3,128}$/.test(workspace)) return json({ error: "实时模型服务尚未完成密钥配置" }, 503, origin);
  const offer = await req.text();
  if (!offer || new TextEncoder().encode(offer).byteLength > 1024 * 1024) return json({ error: "SDP 内容无效" }, 400, origin);
  const upstream = await fetch(`https://${workspace}.cn-beijing.maas.aliyuncs.com/api/v1/webrtc/realtime?model=${encodeURIComponent(MODEL)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/sdp" },
    body: offer,
    signal: AbortSignal.timeout(15_000),
  });
  const answer = await upstream.text();
  if (!upstream.ok) {
    console.error("Realtime upstream failed", upstream.status, answer.slice(0, 300));
    return json({ error: `实时模型连接失败（${upstream.status}）` }, 502, origin);
  }
  return new Response(answer, { status: 200, headers: { ...cors(origin), "Content-Type": "application/sdp", "Cache-Control": "no-store" } });
}

function normalizeMessage(event: Record<string, unknown>) {
  const type = String(event.type || "");
  let role = ""; let body = "";
  if (type === "conversation.item.input_audio_transcription.completed") { role = "user"; body = String(event.transcript || event.text || "").trim(); }
  if (type === "response.audio_transcript.done") { role = "assistant"; body = String(event.transcript || "").trim(); }
  if (type === "response.text.done") { role = "assistant"; body = String(event.text || "").trim(); }
  if (!role || !body) return null;
  return { role, body: body.slice(0, 8000), source_id: String(event.item_id || event.response_id || event.event_id || crypto.randomUUID()).slice(0, 128) };
}

async function rememberEvent(req: Request, sessionId: string, origin: string | null) {
  if (!await findSession(sessionId)) return json({ error: "实时会话不存在或已过期" }, 404, origin);
  const payload = await req.json().catch(() => ({}));
  const message = normalizeMessage(payload.event || {});
  if (!message) return json({ stored: false }, 200, origin);
  await database("session_messages?on_conflict=session_id,role,source_id", {
    method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ session_id: sessionId, ...message }),
  });
  return json({ stored: true }, 201, origin);
}

async function updateLevel(req: Request, sessionId: string, origin: string | null) {
  const session = await findSession(sessionId);
  if (!session) return json({ error: "实时会话不存在或已过期" }, 404, origin);
  const payload = await req.json().catch(() => ({}));
  const args = payload.arguments || {};
  const requested = Number(args.requested_level);
  const reason = String(args.reason || "").trim().slice(0, 1000);
  if (!Number.isInteger(requested) || requested < 1 || requested > 6 || !reason) return json({ error: "学习等级参数无效" }, 400, origin);
  const turns = await database(`session_messages?session_id=eq.${sessionId}&role=eq.user&select=id&limit=3`) as unknown[];
  const profiles = await database(`learner_profiles?conversation_id=eq.${session.conversation_id}&select=level,label&limit=1`) as Array<{ level: number; label: string }>;
  const current = profiles[0] || { level: 4, label: LEVEL_LABELS[4] };
  if (turns.length < 3) return json({ applied: false, reason: "At least three learner turns are required", learner_profile: current }, 200, origin);
  const level = Math.max(current.level - 1, Math.min(current.level + 1, requested));
  const updated = await database(`learner_profiles?conversation_id=eq.${session.conversation_id}`, {
    method: "PATCH", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ level, label: LEVEL_LABELS[level], last_reason: reason, updated_at: new Date().toISOString() }),
  });
  return json({ applied: level !== current.level, requested_level: requested, applied_level: level, learner_profile: updated?.[0] }, 200, origin);
}

async function saveMetrics(req: Request, sessionId: string, origin: string | null) {
  if (!await findSession(sessionId)) return json({ error: "实时会话不存在或已过期" }, 404, origin);
  const payload = await req.json().catch(() => ({}));
  await database("realtime_metrics", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ session_id: sessionId, payload }) });
  return json({ recorded: true }, 201, origin);
}

async function closeSession(sessionId: string, origin: string | null) {
  const session = await findSession(sessionId);
  if (!session) return json({ closed: true }, 200, origin);
  await database(`realtime_sessions?id=eq.${sessionId}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "closed", closed_at: new Date().toISOString() }),
  });
  return json({ closed: true }, 200, origin);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (!originAllowed(origin)) return json({ error: "该网页来源未获允许" }, 403, null);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (!ACCEPTED_PUBLIC_KEYS.has(req.headers.get("apikey") || "")) return json({ error: "无效的公开访问密钥" }, 401, origin);
  const url = new URL(req.url);
  const path = url.pathname.split("/realtime-gateway")[1] || "/";
  try {
    if (req.method === "GET" && path === "/health") return json({ status: "ok", model_configured: Boolean(Deno.env.get("DASHSCOPE_API_KEY") && Deno.env.get("BAILIAN_WORKSPACE_ID")) }, 200, origin);
    if (req.method === "POST" && path === "/session") return await createSession(req, origin);
    if (req.method === "POST" && path === "/sdp") return await exchangeSdp(req, url.searchParams.get("session_id") || "", origin);
    const match = path.match(/^\/session\/([0-9a-f-]{36})(?:\/(events|learner-level|metrics))?$/i);
    if (match && req.method === "POST" && match[2] === "events") return await rememberEvent(req, match[1], origin);
    if (match && req.method === "POST" && match[2] === "learner-level") return await updateLevel(req, match[1], origin);
    if (match && req.method === "POST" && match[2] === "metrics") return await saveMetrics(req, match[1], origin);
    if (match && req.method === "DELETE" && !match[2]) return await closeSession(match[1], origin);
    return json({ error: "接口不存在" }, 404, origin);
  } catch (error) {
    console.error("Realtime gateway error", error instanceof Error ? error.message : String(error));
    return json({ error: error instanceof DOMException && error.name === "TimeoutError" ? "实时模型连接超时" : "服务暂时不可用，请稍后再试" }, 500, origin);
  }
});
