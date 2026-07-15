const endpoint = window.RECOMMENDED_READINGS_ENDPOINT || "";
const entriesEl = document.querySelector("[data-readings-entries]");
const statusEl = document.querySelector("[data-readings-status]");

function endpointReady(value) {
  return Boolean(safeUrl(value));
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "recently";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function entryTemplate(entry) {
  const article = document.createElement("article");
  article.className = "reading-entry";
  const title = document.createElement("a");
  title.className = "reading-entry-title";
  title.textContent = entry.title || "Untitled reading";
  const href = safeUrl(entry.canonical_url);
  if (href) {
    title.href = href;
    title.target = "_blank";
    title.rel = "noopener noreferrer";
  }
  article.append(title);

  const byline = [entry.author, entry.publication].filter(Boolean).join(" · ");
  if (byline) {
    const bylineEl = document.createElement("p");
    bylineEl.className = "reading-entry-byline";
    bylineEl.textContent = byline;
    article.append(bylineEl);
  }

  const summary = document.createElement("p");
  summary.className = "reading-entry-summary";
  summary.textContent = entry.note || "A short summary is not available yet.";
  article.append(summary);

  const footer = document.createElement("div");
  footer.className = "reading-entry-footer";
  const added = document.createElement("span");
  added.textContent = `Added ${formatDate(entry.added_at)}`;
  footer.append(added);
  if (Array.isArray(entry.tags) && entry.tags.length) {
    const tags = document.createElement("span");
    tags.className = "reading-entry-tags";
    for (const tag of entry.tags) {
      const tagEl = document.createElement("span");
      tagEl.textContent = tag;
      tags.append(tagEl);
    }
    footer.append(tags);
  }
  article.append(footer);
  return article;
}

async function loadReadings() {
  if (!endpointReady(endpoint)) {
    statusEl.textContent = "Recommended readings are not configured yet.";
    return;
  }
  try {
    statusEl.textContent = "Loading readings…";
    const response = await fetch(`${endpoint}?limit=100`, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    const body = await response.json();
    const readings = Array.isArray(body.readings) ? body.readings : [];
    entriesEl.replaceChildren();
    if (!readings.length) {
      statusEl.textContent = "Nothing here yet. Check back soon.";
      return;
    }
    for (const reading of readings) entriesEl.append(entryTemplate(reading));
    statusEl.textContent = "";
    entriesEl.hidden = false;
  } catch {
    statusEl.textContent = "Could not load the reading list right now. Please try again later.";
  }
}

loadReadings();
