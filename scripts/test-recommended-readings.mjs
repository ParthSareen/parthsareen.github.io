import assert from "node:assert/strict";
import { handleRecommendedReadingsRequest } from "../supabase/functions/recommended-readings/logic.js";

class Query {
  constructor(rows) {
    this.rows = rows;
    this.limitCount = 100;
  }
  select() { return this; }
  order() { return this; }
  limit(count) { this.limitCount = count; return this; }
  then(resolve, reject) {
    Promise.resolve({ data: this.rows.slice(0, this.limitCount), error: null }).then(resolve, reject);
  }
}

const rows = [{ id: "row-1", title: "A reading", canonical_url: "https://example.com", one_liner: "A short preview.", note: "A fuller description.", tags: [], added_at: "2026-07-15T00:00:00.000Z" }];
const supabase = { from() { return new Query(rows); } };
const getEnv = () => undefined;

{
  const response = await handleRecommendedReadingsRequest(new Request("https://example.test/functions/v1/recommended-readings?limit=1", {
    headers: { origin: "https://parthsareen.com" },
  }), { supabase, getEnv });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://parthsareen.com");
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=3600, s-maxage=86400");
  const body = await response.json();
  assert.equal(body.readings.length, 1);
  assert.equal(body.readings[0].one_liner, "A short preview.");
}

{
  const response = await handleRecommendedReadingsRequest(new Request("https://example.test/functions/v1/recommended-readings", { method: "POST" }), { supabase, getEnv });
  assert.equal(response.status, 405);
  assert.equal((await response.json()).error, "method_not_allowed");
}

console.log("recommended readings tests passed");
