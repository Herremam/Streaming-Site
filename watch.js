// ─── CONFIG ───────────────────────────────────────────────────────────────────
const WATCH_API_KEY = "e9bb455fd0a77ed6738fa3e7826b4ee9";
const WATCH_TMDB    = "https://api.themoviedb.org/3";
const WATCH_IMG     = "https://image.tmdb.org/t/p/";

// ─── EMBED SOURCES ────────────────────────────────────────────────────────────
const SOURCES = {
  vsembed: {
    movie: (id)       => `https://vsembed.su/embed/movie/${id}`,
    tv:    (id, s, e) => `https://vsembed.su/embed/tv/${id}/${s}/${e}`,
  },
  vidsrc: {
    movie: (id)       => `https://vidsrc.me/embed/movie?tmdb=${id}`,
    tv:    (id, s, e) => `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  },
  "2embed": {
    movie: (id)       => `https://www.2embed.cc/embed/${id}`,
    tv:    (id, s, e) => `https://www.2embed.cc/embedtvfull/${id}&s=${s}&e=${e}`,
  },
};

// ─── STATE ────────────────────────────────────────────────────────────────────
const params       = new URLSearchParams(window.location.search);
const mediaId      = params.get("id");
const mediaType    = params.get("type") || "movie";
let currentSource  = "vsembed";
let currentSeason  = 1;
let currentEpisode = 1;
let totalSeasons   = 1;
let episodeCounts  = {};
let episodeNames   = {}; // episodeNames[season][episode] = "Episode Title"

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  if (!mediaId) { showError("No title selected."); return; }

  setupSourceButtons();
  setupSearchNav();

  if (mediaType === "tv") {
    document.getElementById("episode-bar").classList.remove("hidden");
    await loadTVDetails();
  } else {
    await loadMovieDetails();
  }

  loadSimilar();
});

// ─── MOVIE ────────────────────────────────────────────────────────────────────
async function loadMovieDetails() {
  const [movie, credits] = await Promise.all([
    fetch(`${WATCH_TMDB}/movie/${mediaId}?api_key=${WATCH_API_KEY}`).then(r => r.json()),
    fetch(`${WATCH_TMDB}/movie/${mediaId}/credits?api_key=${WATCH_API_KEY}`).then(r => r.json()),
  ]);
  document.title = `${movie.title} — StreamVault`;
  renderDetails(movie, credits);
  loadPlayer();
}

// ─── TV ───────────────────────────────────────────────────────────────────────
async function loadTVDetails() {
  const [show, credits] = await Promise.all([
    fetch(`${WATCH_TMDB}/tv/${mediaId}?api_key=${WATCH_API_KEY}`).then(r => r.json()),
    fetch(`${WATCH_TMDB}/tv/${mediaId}/credits?api_key=${WATCH_API_KEY}`).then(r => r.json()),
  ]);
  document.title = `${show.name} — StreamVault`;
  totalSeasons = show.number_of_seasons || 1;
  (show.seasons || []).forEach(s => {
    if (s.season_number > 0) episodeCounts[s.season_number] = s.episode_count;
  });
  renderDetails(show, credits);
  buildSeasonSelect();
  await loadEpisodeNames(currentSeason);
  buildEpisodeSelect();
  setupEpisodeNav();
  loadPlayer();
}

async function loadEpisodeNames(season) {
  if (episodeNames[season]) return; // already cached
  try {
    const res  = await fetch(`${WATCH_TMDB}/tv/${mediaId}/season/${season}?api_key=${WATCH_API_KEY}`);
    const data = await res.json();
    episodeNames[season] = {};
    (data.episodes || []).forEach(ep => {
      episodeNames[season][ep.episode_number] = ep.name || `Episode ${ep.episode_number}`;
    });
  } catch (e) {
    episodeNames[season] = {};
  }
}

function buildSeasonSelect() {
  const sel = document.getElementById("season-select");
  sel.innerHTML = "";
  for (let s = 1; s <= totalSeasons; s++) {
    const opt = document.createElement("option");
    opt.value = s; opt.textContent = `Season ${s}`;
    sel.appendChild(opt);
  }
  sel.value = currentSeason;
  sel.onchange = async () => {
    currentSeason = parseInt(sel.value);
    currentEpisode = 1;
    await loadEpisodeNames(currentSeason);
    buildEpisodeSelect();
    updateEpDisplay();
  };
}

function buildEpisodeSelect() {
  const sel   = document.getElementById("episode-select");
  const count = episodeCounts[currentSeason] || 1;
  const names = episodeNames[currentSeason] || {};
  sel.innerHTML = "";
  for (let e = 1; e <= count; e++) {
    const opt = document.createElement("option");
    opt.value = e;
    opt.textContent = names[e] ? `${e}. ${names[e]}` : `Episode ${e}`;
    sel.appendChild(opt);
  }
  sel.value = currentEpisode;
  sel.onchange = () => { currentEpisode = parseInt(sel.value); updateEpDisplay(); };
}

function setupEpisodeNav() {
  document.getElementById("ep-load").onclick = loadPlayer;
  document.getElementById("prev-ep").onclick = async () => {
    if (currentEpisode > 1) { currentEpisode--; }
    else if (currentSeason > 1) { currentSeason--; currentEpisode = episodeCounts[currentSeason] || 1; }
    await syncEpisodeSelects(); loadPlayer();
  };
  document.getElementById("next-ep").onclick = async () => {
    const maxEp = episodeCounts[currentSeason] || 1;
    if (currentEpisode < maxEp) { currentEpisode++; }
    else if (currentSeason < totalSeasons) { currentSeason++; currentEpisode = 1; }
    await syncEpisodeSelects(); loadPlayer();
  };
}

async function syncEpisodeSelects() {
  document.getElementById("season-select").value = currentSeason;
  await loadEpisodeNames(currentSeason);
  buildEpisodeSelect();
  updateEpDisplay();
}

function updateEpDisplay() {
  const names   = episodeNames[currentSeason] || {};
  const epName  = names[currentEpisode];
  const display = document.getElementById("ep-display");
  display.textContent = epName
    ? `S${currentSeason} E${currentEpisode} — ${epName}`
    : `S${currentSeason} E${currentEpisode}`;
}

// ─── PLAYER ───────────────────────────────────────────────────────────────────
function loadPlayer() {
  const iframe  = document.getElementById("player-iframe");
  const loading = document.getElementById("player-loading");
  const src     = SOURCES[currentSource];

  // Show spinner, hide iframe
  loading.classList.remove("hidden");
  iframe.classList.add("hidden");
  iframe.src = "about:blank";

  const url = mediaType === "tv"
    ? src.tv(mediaId, currentSeason, currentEpisode)
    : src.movie(mediaId);

  if (mediaType === "tv") updateEpDisplay();

  // iframe.onload won't fire for cross-origin embeds — just reveal after short delay
  setTimeout(() => {
    iframe.src = url;
    iframe.classList.remove("hidden");
    loading.classList.add("hidden");
  }, 500);
}

// ─── SOURCE BUTTONS ───────────────────────────────────────────────────────────
function setupSourceButtons() {
  document.querySelectorAll(".source-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".source-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentSource = btn.dataset.src;
      loadPlayer();
    });
  });
}

// ─── DETAILS ─────────────────────────────────────────────────────────────────
function renderDetails(data, credits) {
  const title   = data.title || data.name || "";
  const year    = (data.release_date || data.first_air_date || "").slice(0, 4);
  const rating  = data.vote_average ? data.vote_average.toFixed(1) : "N/A";
  const runtime = data.runtime ? `${data.runtime}m` : (data.episode_run_time?.[0] ? `${data.episode_run_time[0]}m/ep` : "");
  const genres  = (data.genres || []).map(g => g.name).join(", ");
  const cast    = (credits.cast || []).slice(0, 6).map(c => c.name).join(", ");

  if (data.poster_path) {
    document.getElementById("detail-poster").src = `${WATCH_IMG}w342${data.poster_path}`;
  }
  const badges = [];
  if (data.adult) badges.push('<span class="badge red">18+</span>');
  if (rating !== "N/A") badges.push(`<span class="badge gold">★ ${rating}</span>`);
  document.getElementById("detail-badges").innerHTML = badges.join("");
  document.getElementById("detail-title").textContent    = title;
  document.getElementById("detail-overview").textContent = data.overview || "";
  document.getElementById("detail-meta").innerHTML = [
    year    ? `<span>${year}</span>`    : "",
    runtime ? `<span>${runtime}</span>` : "",
    genres  ? `<span>${genres}</span>`  : "",
  ].join("");
  if (cast) {
    document.getElementById("detail-cast").innerHTML = `<p><strong>Cast:</strong> ${cast}</p>`;
  }
}

// ─── SIMILAR ─────────────────────────────────────────────────────────────────
async function loadSimilar() {
  const res  = await fetch(`${WATCH_TMDB}/${mediaType}/${mediaId}/similar?api_key=${WATCH_API_KEY}&page=1`);
  const data = await res.json();
  const grid = document.getElementById("similar-grid");
  (data.results || []).filter(i => i.poster_path).slice(0, 12).forEach(item => {
    const title = item.title || item.name || "";
    const year  = (item.release_date || item.first_air_date || "").slice(0, 4);
    const card  = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-img-wrap">
        <img src="${WATCH_IMG}w342${item.poster_path}" alt="${title}" loading="lazy" />
        <div class="card-overlay"><button class="btn-play">▶</button></div>
      </div>
      <div class="card-info">
        <p class="card-title">${title}</p>
        <span class="card-year">${year}</span>
      </div>`;
    card.onclick = () => { window.location.href = `movie.html?id=${item.id}&type=${mediaType}`; };
    grid.appendChild(card);
  });
}

// ─── SEARCH (navigate on Enter or submit) ────────────────────────────────────
function setupSearchNav() {
  const input    = document.getElementById("search");
  const dropdown = document.getElementById("search-results");
  if (!input) return;

  let debounce;
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      const q = input.value.trim();
      if (q) window.location.href = `search.html?q=${encodeURIComponent(q)}`;
    }
  });

  input.addEventListener("input", () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    if (!q) { dropdown.classList.add("hidden"); return; }
    debounce = setTimeout(async () => {
      const res  = await fetch(`${WATCH_TMDB}/search/multi?api_key=${WATCH_API_KEY}&query=${encodeURIComponent(q)}&page=1`);
      const data = await res.json();
      const results = (data.results || []).filter(r => r.media_type !== "person" && r.poster_path).slice(0, 6);
      if (!results.length) { dropdown.classList.add("hidden"); return; }
      dropdown.innerHTML = results.map(item => {
        const t = item.title || item.name || "";
        const y = (item.release_date || item.first_air_date || "").slice(0, 4);
        return `<div class="sr-item" data-id="${item.id}" data-type="${item.media_type}">
          <img src="${WATCH_IMG}w92${item.poster_path}" alt="${t}" />
          <div><strong>${t}</strong><span>${y}</span></div>
        </div>`;
      }).join("");
      dropdown.classList.remove("hidden");
      dropdown.querySelectorAll(".sr-item").forEach(el => {
        el.onclick = () => { window.location.href = `movie.html?id=${el.dataset.id}&type=${el.dataset.type}`; };
      });
    }, 350);
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".search-wrap")) dropdown.classList.add("hidden");
  });
}

function showError(msg) {
  document.getElementById("player-wrap").innerHTML = `<div class="error-msg">${msg}</div>`;
}
