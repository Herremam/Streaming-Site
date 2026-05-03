// ─── PROGRESS / CONTINUE WATCHING ────────────────────────────────────────────
// Shared localStorage helper. Import via <script src="progress.js"> on any page.

const PROGRESS_KEY = "sv_progress";   // key for the full progress map
const MAX_ITEMS    = 50;              // max titles to remember

// ── Read / Write ──────────────────────────────────────────────────────────────

function progressGetAll() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; }
  catch { return {}; }
}

function progressSave(id, type, data) {
  const all = progressGetAll();
  all[`${type}_${id}`] = { id, type, updatedAt: Date.now(), ...data };

  // Trim oldest if over limit
  const entries = Object.entries(all).sort((a, b) => b[1].updatedAt - a[1].updatedAt);
  if (entries.length > MAX_ITEMS) entries.splice(MAX_ITEMS);
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(Object.fromEntries(entries))); }
  catch { /* storage full — fail silently */ }
}

function progressGet(id, type) {
  return progressGetAll()[`${type}_${id}`] || null;
}

function progressRemove(id, type) {
  const all = progressGetAll();
  delete all[`${type}_${id}`];
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(all)); } catch { }
}

// ── Continue Watching row (homepage / search) ─────────────────────────────────

function renderContinueWatching(containerEl, imgBase) {
  const all = progressGetAll();
  const items = Object.values(all)
    .filter(p => p.poster_path)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 12);

  if (!items.length) { containerEl.closest(".cw-section")?.remove(); return; }

  containerEl.innerHTML = "";
  items.forEach(item => {
    const title    = item.title || "";
    const subtitle = item.type === "tv" && item.season
      ? `S${item.season} E${item.episode}`
      : item.year || "";
    const pct = item.type === "movie" && item.duration
      ? Math.min(100, Math.round((item.timestamp / item.duration) * 100))
      : null;

    const card = document.createElement("div");
    card.className = "card cw-card";
    card.innerHTML = `
      <div class="card-img-wrap">
        <img src="${imgBase}w342${item.poster_path}" alt="${title}" loading="lazy" />
        <div class="card-overlay"><button class="btn-play">▶</button></div>
        ${pct !== null ? `<div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>` : ""}
        <button class="cw-remove" title="Remove" data-id="${item.id}" data-type="${item.type}">✕</button>
      </div>
      <div class="card-info">
        <p class="card-title">${title}</p>
        <span class="card-year">${subtitle}</span>
      </div>`;
    card.querySelector(".cw-remove").onclick = e => {
      e.stopPropagation();
      progressRemove(item.id, item.type);
      card.remove();
      if (!containerEl.children.length) containerEl.closest(".cw-section")?.remove();
    };
    card.onclick = e => {
      if (e.target.classList.contains("cw-remove")) return;
      window.location.href = `movie.html?id=${item.id}&type=${item.type}`;
    };
    containerEl.appendChild(card);
  });
}
