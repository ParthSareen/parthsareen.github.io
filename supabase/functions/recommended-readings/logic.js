const DEFAULT_TABLE = "recommended_readings";
const DEFAULT_PUBLIC_LIMIT = 100;
const DEFAULT_ALLOWED_ORIGINS = "https://parthsareen.com,https://parthsareen.github.io,http://127.0.0.1:8080,http://localhost:8080";

export function createRecommendedReadingsHandler({ createClient, env }) {
  const getEnv = makeEnvReader(env);
  const { url, secretKey } = getSupabaseCredentials(getEnv);
  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return (request) => handleRecommendedReadingsRequest(request, { supabase, getEnv });
}

export async function handleRecommendedReadingsRequest(request, { supabase, getEnv }) {
  const headers = corsHeaders(request, getEnv);
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (method !== "GET") return json({ error: "method_not_allowed" }, { status: 405, headers });

  try {
    const requestUrl = new URL(request.url);
    const limit = clamp(Number(requestUrl.searchParams.get("limit") || getEnv("RECOMMENDED_READINGS_PUBLIC_LIMIT") || DEFAULT_PUBLIC_LIMIT), 1, 100);
    const table = getEnv("RECOMMENDED_READINGS_TABLE") || DEFAULT_TABLE;
    const result = await supabase
      .from(table)
      .select("id, canonical_url, title, author, publication, one_liner, note, tags, published_at, added_at")
      .order("added_at", { ascending: false })
      .limit(limit);

    if (result.error) return json({ error: "list_failed" }, { status: 500, headers });
    return json({ readings: result.data || [] }, { status: 200, headers });
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
  const secretKey = getEnv("SUPABASE_SECRET_KEY") || getSecretFromJson(getEnv("SUPABASE_SECRET_KEYS")) || getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !secretKey) throw new Error("Missing Supabase credentials");
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
  const allowedOrigins = (getEnv("RECOMMENDED_READINGS_ALLOWED_ORIGINS") || DEFAULT_ALLOWED_ORIGINS)
    .split(",").map((item) => item.trim()).filter(Boolean);
  const origin = request.headers.get("origin");
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function json(body, { status, headers }) {
  return new Response(JSON.stringify(body), { status, headers });
}
