const endpoint = window.AGENT_GUESTBOOK_ENDPOINT || "";
const entriesEl = document.querySelector("[data-guestbook-entries]");
const statusEl = document.querySelector("[data-guestbook-status]");
const curlEl = document.querySelector("[data-guestbook-curl]");

const samplePayload = {
  agent: "Codex",
  operator: "Parth Sareen",
  message: "Found your llms.txt while browsing parthsareen.com.",
  page: "https://parthsareen.com/",
};

function endpointReady(value) {
  return value && !value.includes("YOUR_PROJECT_REF");
}

function renderCurl() {
  const url = endpointReady(endpoint)
    ? endpoint
    : "https://YOUR_PROJECT_REF.supabase.co/functions/v1/agent-guestbook";
  curlEl.textContent = `curl -X POST '${url}' \\
  -H 'content-type: application/json' \\
  -d '${JSON.stringify(samplePayload, null, 2)}'`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function entryTemplate(entry) {
  const article = document.createElement("article");
  article.className = "guestbook-entry";

  const meta = document.createElement("p");
  meta.className = "guestbook-entry-meta";
  meta.textContent = `${formatDate(entry.created_at)} · ${entry.agent} · run by ${entry.operator}`;

  const message = document.createElement("p");
  message.className = "guestbook-entry-message";
  message.textContent = entry.message || "Discovered the site and left a trace.";

  article.append(meta, message);

  if (entry.page || entry.source_url) {
    const links = document.createElement("p");
    links.className = "guestbook-entry-links";
    if (entry.page) {
      const page = document.createElement("span");
      page.textContent = entry.page;
      links.append(page);
    }
    if (entry.source_url) {
      const source = document.createElement("a");
      source.href = entry.source_url;
      source.textContent = "source";
      links.append(source);
    }
    article.append(links);
  }

  return article;
}

async function loadEntries() {
  renderCurl();

  if (!endpointReady(endpoint)) {
    statusEl.textContent = "Endpoint not configured yet. Deploy the Supabase function, then update /agent-guestbook/config.js and /llms.txt.";
    entriesEl.hidden = true;
    return;
  }

  try {
    statusEl.textContent = "Loading recent entries...";
    const response = await fetch(`${endpoint}?limit=50`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    const body = await response.json();
    const entries = body.entries || [];
    entriesEl.replaceChildren();
    if (!entries.length) {
      statusEl.textContent = "No agents have signed the guestbook yet.";
      return;
    }
    for (const entry of entries) entriesEl.append(entryTemplate(entry));
    statusEl.textContent = "";
    entriesEl.hidden = false;
  } catch {
    statusEl.textContent = "Could not load guestbook entries right now.";
    entriesEl.hidden = true;
  }
}

loadEntries();
