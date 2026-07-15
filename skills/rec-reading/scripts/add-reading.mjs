import { createRequire } from "node:module";
import path from "node:path";

const DEFAULT_REPO = "/Users/parth/Documents/repos/parthsareen.github.io";
const MAX_HTML_BYTES = 1_000_000;
const DEFAULT_SUMMARY = "A concise summary was unavailable when this was added.";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourceUrl = requireHttpUrl(options.url, "URL");
  const metadata = await getMetadata(sourceUrl);
  const entry = {
    canonical_url: requireHttpUrl(options.canonicalUrl || metadata.canonicalUrl || sourceUrl, "canonical URL"),
    title: cleanText(options.title || metadata.title || new URL(sourceUrl).hostname, 240),
    author: cleanText(options.author || metadata.author, 160) || null,
    publication: cleanText(options.publication || metadata.publication, 160) || null,
    one_liner: cleanText(options.oneLiner || firstSentence(metadata.description) || options.summary || metadata.title || new URL(sourceUrl).hostname, 180),
    note: cleanText(options.summary || metadata.description || DEFAULT_SUMMARY, 600),
    tags: cleanTags(options.tags),
    published_at: parseDate(options.publishedAt || metadata.publishedAt),
  };

  if (!entry.title || !entry.one_liner || !entry.note) throw new Error("Title, one-liner, and note must not be empty.");
  if (options.dryRun) {
    console.log(JSON.stringify({ dry_run: true, entry }, null, 2));
    return;
  }

  const repo = process.env.REC_READING_REPO || DEFAULT_REPO;
  const requireFromRepo = createRequire(path.join(repo, "package.json"));
  const { config } = requireFromRepo("dotenv");
  config({ path: path.join(repo, ".env"), override: true });
  const { createClient } = requireFromRepo("@supabase/supabase-js");
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !secretKey) {
    throw new Error("Missing SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in the local .env.");
  }

  const client = createClient(supabaseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const inserted = await client.from("recommended_readings").upsert(entry, { onConflict: "canonical_url" })
    .select("id, canonical_url, title, author, publication, one_liner, note, tags, published_at, added_at").single();
  if (inserted.error) {
    throw new Error(`Write failed: ${inserted.error.message}`);
  }
  const verified = await client.from("recommended_readings")
    .select("id, canonical_url, title, author, publication, one_liner, note, tags, published_at, added_at")
    .eq("id", inserted.data.id).single();
  if (verified.error || !verified.data) throw new Error("Inserted row could not be read back for verification.");
  console.log(JSON.stringify({ ok: true, reading: verified.data }, null, 2));
}

function parseArgs(args) {
  const options = { tags: [] };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith("--") && !options.url) { options.url = value; continue; }
    if (value === "--dry-run") { options.dryRun = true; continue; }
    const key = value.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`Expected a value after ${value}.`);
    index += 1;
    if (key === "tags") options.tags = next.split(",");
    else if (key === "note" || key === "summary") options.summary = next;
    else if (key === "one-liner") options.oneLiner = next;
    else if (key === "title") options.title = next;
    else if (key === "author") options.author = next;
    else if (key === "publication") options.publication = next;
    else if (key === "published-at") options.publishedAt = next;
    else if (key === "canonical-url") options.canonicalUrl = next;
    else throw new Error(`Unknown option: --${key}.`);
  }
  if (!options.url) throw new Error("Usage: add-reading.mjs <url> [--one-liner text] [--summary text] [--tags one,two] [--dry-run]");
  return options;
}

async function getMetadata(sourceUrl) {
  try {
    const response = await fetch(sourceUrl, { headers: { "user-agent": "ParthSareenReadingList/1.0" }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) throw new Error(`Unsupported content type: ${contentType || "unknown"}`);
    const html = await readBoundedBody(response);
    return extractMetadata(html, response.url || sourceUrl);
  } catch (error) {
    console.error(`Metadata unavailable; using the supplied URL and hostname instead (${error.message}).`);
    return { canonicalUrl: sourceUrl, title: new URL(sourceUrl).hostname };
  }
}

async function readBoundedBody(response) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_HTML_BYTES) throw new Error("Page is larger than the metadata limit.");
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_HTML_BYTES) throw new Error("Page is larger than the metadata limit.");
    chunks.push(value);
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(output);
}

function extractMetadata(html, finalUrl) {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => attributes(tag));
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => attributes(tag));
  const meta = (...names) => {
    const wanted = new Set(names.map((name) => name.toLowerCase()));
    const match = metas.find((attrs) => wanted.has(String(attrs.name || attrs.property || attrs.itemprop || "").toLowerCase()));
    return match?.content || "";
  };
  const canonical = links.find((attrs) => String(attrs.rel || "").toLowerCase().split(/\s+/).includes("canonical"))?.href;
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  return {
    canonicalUrl: canonical ? safeResolvedUrl(canonical, finalUrl) : finalUrl,
    title: cleanText(meta("og:title", "twitter:title", "citation_title", "dc.title") || titleTag, 240),
    author: cleanText(meta("citation_author", "author", "article:author", "dc.creator"), 160),
    publication: cleanText(meta("og:site_name", "citation_journal_title", "article:publisher", "publisher"), 160),
    description: cleanText(meta("description", "og:description", "twitter:description", "citation_abstract", "dc.description"), 600),
    publishedAt: parseDate(meta("article:published_time", "citation_publication_date", "date", "dc.date")),
  };
}

function attributes(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const key = match[1].toLowerCase();
    if (key !== "meta" && key !== "link") attrs[key] = decodeEntities(match[2] || match[3] || match[4] || "");
  }
  return attrs;
}

function cleanText(value, maxLength) {
  return decodeEntities(String(value || "").replace(/<[^>]*>/g, " "))
    .replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function firstSentence(value) {
  const text = cleanText(value, 600);
  if (!text) return "";
  const match = text.match(/^.*?[.!?](?:\s|$)/);
  return match ? match[0].trim() : text;
}

function cleanTags(tags) {
  return [...new Set((tags || []).map((tag) => cleanText(tag, 40).toLowerCase()).filter(Boolean))].slice(0, 8);
}

function decodeEntities(value) {
  return String(value).replace(/&(?:amp|#38);/gi, "&").replace(/&(?:quot|#34);/gi, '"').replace(/&(?:apos|#39);/gi, "'")
    .replace(/&(?:lt|#60);/gi, "<").replace(/&(?:gt|#62);/gi, ">").replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function parseDate(value) {
  if (!value) return null;
  const matched = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  if (matched && !Number.isNaN(new Date(`${matched[0]}T00:00:00Z`).valueOf())) return matched[0];
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString().slice(0, 10);
}

function safeResolvedUrl(value, base) {
  try { return requireHttpUrl(new URL(value, base).href, "canonical URL"); } catch { return base; }
}

function requireHttpUrl(value, label) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`${label} must use http or https.`);
  return url.href;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
