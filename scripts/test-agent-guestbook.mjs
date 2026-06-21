import assert from "node:assert/strict";
import { handleAgentGuestbookRequest } from "../supabase/functions/agent-guestbook/logic.js";

const baseEnv = {
  AGENT_GUESTBOOK_HOURLY_LIMIT: "3",
  AGENT_GUESTBOOK_DAILY_LIMIT: "10",
  AGENT_GUESTBOOK_MAX_ROWS: "20",
  AGENT_GUESTBOOK_SALT: "test-salt",
};

function env(name) {
  return baseEnv[name];
}

function makeRequest(body, headers = {}) {
  return new Request("https://example.test/functions/v1/agent-guestbook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.42",
      "user-agent": "Codex-Test/1.0",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function readJson(response) {
  return JSON.parse(await response.text());
}

class Query {
  constructor(store, table) {
    this.store = store;
    this.table = table;
    this.op = "select";
    this.rows = null;
    this.filters = [];
    this.orderSpec = null;
    this.limitCount = null;
    this.rangeSpec = null;
    this.singleResult = false;
  }

  select() {
    this.op = this.op === "insert" ? "insert_select" : "select";
    return this;
  }

  insert(row) {
    this.op = "insert";
    this.rows = Array.isArray(row) ? row : [row];
    return this;
  }

  delete() {
    this.op = "delete";
    return this;
  }

  eq(key, value) {
    this.filters.push((row) => row[key] === value);
    return this;
  }

  gte(key, value) {
    this.filters.push((row) => String(row[key]) >= String(value));
    return this;
  }

  in(key, values) {
    const set = new Set(values);
    this.filters.push((row) => set.has(row[key]));
    return this;
  }

  order(key, options = {}) {
    this.orderSpec = { key, ascending: options.ascending !== false };
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  range(from, to) {
    this.rangeSpec = { from, to };
    return this;
  }

  single() {
    this.singleResult = true;
    return this;
  }

  then(resolve, reject) {
    Promise.resolve(this.execute()).then(resolve, reject);
  }

  execute() {
    if (this.op === "insert" || this.op === "insert_select") {
      const inserted = this.rows.map((row) => ({
        id: `row-${this.store.rows.length + 1}`,
        created_at: new Date(this.store.now.getTime() + this.store.rows.length).toISOString(),
        ...row,
      }));
      this.store.rows.push(...inserted);
      const data = this.singleResult ? inserted[0] : inserted;
      return { data, error: null };
    }

    if (this.op === "delete") {
      const before = this.store.rows.length;
      this.store.rows = this.store.rows.filter((row) => !this.filters.every((filter) => filter(row)));
      return { data: [{ deleted: before - this.store.rows.length }], error: null };
    }

    let rows = this.store.rows.filter((row) => this.filters.every((filter) => filter(row)));
    if (this.orderSpec) {
      const { key, ascending } = this.orderSpec;
      rows = rows.toSorted((a, b) => {
        if (a[key] === b[key]) return 0;
        return (a[key] < b[key] ? -1 : 1) * (ascending ? 1 : -1);
      });
    }
    if (this.rangeSpec) {
      rows = rows.slice(this.rangeSpec.from, this.rangeSpec.to + 1);
    }
    if (this.limitCount !== null) {
      rows = rows.slice(0, this.limitCount);
    }
    return { data: rows, error: null };
  }
}

function makeSupabase(now = new Date("2026-06-20T12:00:00.000Z")) {
  const store = { rows: [], now };
  return {
    store,
    from(table) {
      return new Query(store, table);
    },
  };
}

{
  const response = await handleAgentGuestbookRequest(new Request("https://example.test", { method: "OPTIONS" }), {
    supabase: makeSupabase(),
    getEnv: env,
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Methods"), "GET, POST, OPTIONS");
}

{
  const response = await handleAgentGuestbookRequest(makeRequest({ operator: "Parth" }), {
    supabase: makeSupabase(),
    getEnv: env,
  });
  const body = await readJson(response);
  assert.equal(response.status, 400);
  assert.equal(body.error, "missing_required_fields");
  assert.deepEqual(body.details.fields, ["agent"]);
}

{
  const supabase = makeSupabase();
  const response = await handleAgentGuestbookRequest(makeRequest({
    agent: "Codex",
    operator: "Parth",
    message: "Found your llms.txt.",
    page: "/",
  }), {
    supabase,
    getEnv: env,
    now: () => supabase.store.now,
  });
  const body = await readJson(response);
  assert.equal(response.status, 201);
  assert.equal(body.ok, true);
  assert.equal(body.entry.agent, "Codex");
  assert.equal(supabase.store.rows.length, 1);
  assert.equal(supabase.store.rows[0].ip_hash.length, 64);
}

{
  const supabase = makeSupabase();
  for (let index = 0; index < 3; index += 1) {
    const response = await handleAgentGuestbookRequest(makeRequest({
      agent: `Agent ${index}`,
      operator: "Parth",
      message: "hello",
    }), {
      supabase,
      getEnv: env,
      now: () => supabase.store.now,
    });
    assert.equal(response.status, 201);
  }
  const limited = await handleAgentGuestbookRequest(makeRequest({
    agent: "Fourth",
    operator: "Parth",
  }), {
    supabase,
    getEnv: env,
    now: () => supabase.store.now,
  });
  const body = await readJson(limited);
  assert.equal(limited.status, 429);
  assert.equal(body.error, "rate_limited");
  assert.equal(body.window, "hour");
}

{
  const supabase = makeSupabase();
  await handleAgentGuestbookRequest(makeRequest({
    agent: "Codex",
    operator: "Parth",
    message: "hello",
  }), {
    supabase,
    getEnv: env,
    now: () => supabase.store.now,
  });
  const response = await handleAgentGuestbookRequest(new Request("https://example.test/functions/v1/agent-guestbook?limit=5"), {
    supabase,
    getEnv: env,
  });
  const body = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(body.entries.length, 1);
  assert.equal(body.entries[0].agent, "Codex");
}

console.log("agent guestbook tests passed");
