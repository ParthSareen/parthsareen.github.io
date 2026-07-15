const endpoint = window.RECOMMENDED_READINGS_ENDPOINT || "";
const entriesEl = document.querySelector("[data-home-readings]");
const statusEl = document.querySelector("[data-home-readings-status]");

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
  if (Number.isNaN(date.valueOf())) return "Recently added";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function readingTemplate(reading) {
  const item = document.createElement("a");
  item.className = "magazine-item";
  const href = safeUrl(reading.canonical_url);
  item.href = href || "/readings/";
  if (href) {
    item.target = "_blank";
    item.rel = "noopener noreferrer";
  }

  const head = document.createElement("div");
  head.className = "magazine-item-head";
  const meta = document.createElement("span");
  meta.className = "magazine-item-meta";
  meta.textContent = reading.publication || reading.author || "Recommended reading";
  const tag = document.createElement("span");
  tag.className = "magazine-item-tag";
  tag.textContent = formatDate(reading.added_at);
  head.append(meta, tag);

  const title = document.createElement("span");
  title.className = "magazine-item-title";
  title.textContent = reading.title || "Untitled reading";

  const body = document.createElement("div");
  body.className = "magazine-item-body";
  const summary = document.createElement("p");
  summary.className = "magazine-item-dek";
  summary.textContent = reading.one_liner || reading.note || "A short summary is not available yet.";
  const cta = document.createElement("span");
  cta.className = "magazine-item-cta";
  cta.textContent = "Read the article →";
  body.append(summary, cta);
  item.append(head, title, body);
  return item;
}

function enableMagazineHover(items, { openFirst = true } = {}) {
  if (!items.length) return;
  let active = openFirst ? items[0] : null;
  active?.classList.add("is-open");
  for (const item of items) {
    item.addEventListener("mouseenter", () => {
      if (item === active) return;
      active?.classList.remove("is-open");
      item.classList.add("is-open");
      active = item;
    });
    item.addEventListener("mouseleave", () => {
      if (item !== active) return;
      item.classList.remove("is-open");
      active = null;
    });
  }
}

async function loadReadings() {
  if (!entriesEl || !statusEl || !safeUrl(endpoint)) return;
  try {
    const response = await fetch(`${endpoint}?limit=3`, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    const body = await response.json();
    const readings = Array.isArray(body.readings) ? body.readings.slice(0, 3) : [];
    if (!readings.length) {
      statusEl.textContent = "Nothing here yet. Check back soon.";
      return;
    }
    statusEl.remove();
    const items = readings.map(readingTemplate);
    entriesEl.append(...items);
    enableMagazineHover(items, { openFirst: false });
  } catch {
    statusEl.textContent = "Could not load readings right now.";
  }
}

loadReadings();
