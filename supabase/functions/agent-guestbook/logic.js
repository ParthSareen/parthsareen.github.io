const DEFAULT_TABLE = "agent_guestbook";
const DEFAULT_MAX_ROWS = 500;
const DEFAULT_PUBLIC_LIMIT = 50;
const DEFAULT_HOURLY_LIMIT = 3;
const DEFAULT_DAILY_LIMIT = 10;

export function createAgentGuestbookHandler({ createClient, env, now = () => new Date() }) {
  const getEnv = makeEnvReader(env);
  const credentials = getSupabaseCredentials(getEnv);
  const supabase = createClient(credentials.url, credentials.secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return (request) => handleAgentGuestbookRequest(request, { supabase, getEnv, now });
}

export async function handleAgentGuestbookRequest(request, { supabase, getEnv, now = () => new Date() }) {
  const headers = corsHeaders(request, getEnv);
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    if (method === "GET") {
      return await listEntries(request, { supabase, getEnv, headers });
    }

    if (method !== "POST") {
      return json({ error: "method_not_allowed" }, { status: 405, headers });
    }

    const body = await parseJson(request);
    if (!body.ok) {
      return json({ error: "invalid_json" }, { status: 400, headers });
    }

    const payload = normalizePayload(body.value);
    if (!payload.ok) {
      return json({ error: payload.error, details: payload.details }, { status: 400, headers });
    }

    const table = getEnv("AGENT_GUESTBOOK_TABLE") || DEFAULT_TABLE;
    const limits = getLimits(getEnv);
    const identity = await requestIdentity(request, getEnv);
    const current = now();

    const rate = await checkRateLimit({
      supabase,
      table,
      ipHash: identity.ipHash,
      now: current,
      limits,
    });

    if (!rate.ok) {
      return json({
        error: "rate_limited",
        limit: rate.limit,
        window: rate.window,
        retry_after_seconds: rate.retryAfterSeconds,
      }, {
        status: 429,
        headers: {
          ...headers,
          "Retry-After": String(rate.retryAfterSeconds),
        },
      });
    }

    const insert = await supabase
      .from(table)
      .insert({
        ...payload.entry,
        ip_hash: identity.ipHash,
        user_agent_hash: identity.userAgentHash,
        metadata: {
          user_agent_family: identity.userAgentFamily,
        },
      })
      .select("id, created_at, agent, operator, message, page, source_url")
      .single();

    if (insert.error) {
      return json({ error: "insert_failed" }, { status: 500, headers });
    }

    await pruneOldEntries({ supabase, table, maxRows: limits.maxRows });

    return json({ ok: true, entry: insert.data }, { status: 201, headers });
  } catch {
    return json({ error: "server_error" }, { status: 500, headers });
  }
}

function makeEnvReader(env) {
  if (typeof env === "function") return env;
  if (env && typeof env.get === "function") return (name) => env.get(name);
  if (env && typeof env === "object") return (name) => env[name];
  return () => undefined;
}

function getSupabaseCredentials(getEnv) {
  const url = getEnv("SUPABASE_URL");
  const secretKey =
    getEnv("SUPABASE_SECRET_KEY") ||
    getSecretFromJson(getEnv("SUPABASE_SECRET_KEYS")) ||
    getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !secretKey) {
    throw new Error("Missing SUPABASE_URL or Supabase secret key");
  }

  return { url, secretKey };
}

function getSecretFromJson(raw) {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") return parsed;
    if (parsed.default) return parsed.default;
    const firstKey = Object.keys(parsed)[0];
    return firstKey ? parsed[firstKey] : "";
  } catch {
    return "";
  }
}

function corsHeaders(request, getEnv) {
  const configured = getEnv("AGENT_GUESTBOOK_ALLOWED_ORIGINS") || "*";
  const origin = request.headers.get("origin");
  const allowedOrigins = configured.split(",").map((item) => item.trim()).filter(Boolean);
  const allowOrigin = configured === "*"
    ? "*"
    : origin && allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0] || "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}

async function listEntries(request, { supabase, getEnv, headers }) {
  const table = getEnv("AGENT_GUESTBOOK_TABLE") || DEFAULT_TABLE;
  const url = new URL(request.url);
  const limit = clamp(Number(url.searchParams.get("limit") || getEnv("AGENT_GUESTBOOK_PUBLIC_LIMIT") || DEFAULT_PUBLIC_LIMIT), 1, 100);
  const result = await supabase
    .from(table)
    .select("id, created_at, agent, operator, message, page, source_url")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (result.error) {
    return json({ error: "list_failed" }, { status: 500, headers });
  }

  return json({ entries: result.data || [] }, { status: 200, headers });
}

async function parseJson(request) {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}

function normalizePayload(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "invalid_payload" };
  }

  const agent = cleanText(raw.agent || raw.model || raw.tool, 120);
  const operator = cleanText(raw.operator || raw.runner || raw.run_by || raw.user, 120);
  const message = cleanText(raw.message || raw.note || "", 500);
  const page = cleanText(raw.page || raw.path || "", 240);
  const sourceUrl = cleanText(raw.source_url || raw.sourceUrl || raw.url || "", 300);

  const missing = [];
  if (!agent) missing.push("agent");
  if (!operator) missing.push("operator");
  if (missing.length) {
    return { ok: false, error: "missing_required_fields", details: { fields: missing } };
  }

  const combined = [agent, operator, message, page, sourceUrl].join(" ");
  const urlCount = (combined.match(/https?:\/\//gi) || []).length;
  if (urlCount > 2 || /<\s*script/i.test(combined)) {
    return { ok: false, error: "spammy_payload" };
  }

  return {
    ok: true,
    entry: {
      agent,
      operator,
      message: message || null,
      page: page || null,
      source_url: sourceUrl || null,
    },
  };
}

function cleanText(value, maxLength) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function getLimits(getEnv) {
  return {
    hourly: clamp(Number(getEnv("AGENT_GUESTBOOK_HOURLY_LIMIT") || DEFAULT_HOURLY_LIMIT), 1, 100),
    daily: clamp(Number(getEnv("AGENT_GUESTBOOK_DAILY_LIMIT") || DEFAULT_DAILY_LIMIT), 1, 500),
    maxRows: clamp(Number(getEnv("AGENT_GUESTBOOK_MAX_ROWS") || DEFAULT_MAX_ROWS), 20, 5000),
  };
}

async function requestIdentity(request, getEnv) {
  const ip = extractIp(request);
  const userAgent = request.headers.get("user-agent") || "unknown";
  const salt =
    getEnv("AGENT_GUESTBOOK_SALT") ||
    getEnv("SUPABASE_JWT_SECRET") ||
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    "agent-guestbook-local";

  return {
    ipHash: await sha256(`${salt}:ip:${ip}`),
    userAgentHash: await sha256(`${salt}:ua:${userAgent}`),
    userAgentFamily: cleanText(userAgent.split(/[ /]/)[0] || "unknown", 80),
  };
}

function extractIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown";
}

async function sha256(value) {
  const encoded = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function checkRateLimit({ supabase, table, ipHash, now, limits }) {
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const hourly = await countRecent({ supabase, table, ipHash, since: hourAgo, limit: limits.hourly + 1 });
  if (!hourly.ok) return { ok: false, limit: "query_failed", window: "internal", retryAfterSeconds: 60 };
  if (hourly.count >= limits.hourly) {
    return { ok: false, limit: limits.hourly, window: "hour", retryAfterSeconds: 60 * 60 };
  }

  const daily = await countRecent({ supabase, table, ipHash, since: dayAgo, limit: limits.daily + 1 });
  if (!daily.ok) return { ok: false, limit: "query_failed", window: "internal", retryAfterSeconds: 60 };
  if (daily.count >= limits.daily) {
    return { ok: false, limit: limits.daily, window: "day", retryAfterSeconds: 24 * 60 * 60 };
  }

  return { ok: true };
}

async function countRecent({ supabase, table, ipHash, since, limit }) {
  const result = await supabase
    .from(table)
    .select("id")
    .eq("ip_hash", ipHash)
    .gte("created_at", since)
    .limit(limit);

  if (result.error) return { ok: false, count: 0 };
  return { ok: true, count: (result.data || []).length };
}

async function pruneOldEntries({ supabase, table, maxRows }) {
  const overflow = await supabase
    .from(table)
    .select("id")
    .order("created_at", { ascending: false })
    .range(maxRows, maxRows + 99);

  if (overflow.error || !overflow.data?.length) return;

  await supabase
    .from(table)
    .delete()
    .in("id", overflow.data.map((row) => row.id));
}

function json(body, { status, headers }) {
  return new Response(JSON.stringify(body), { status, headers });
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
