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
let episodeNames   = {};
let savedTimestamp = 0;   // seconds — restored from localStorage
let mediaDuration  = 0;   // seconds — updated via postMessage if available
let progressTimer  = null;
let autoNextEnabled = false;       // auto-next toggle state
let autoNextTimer   = null;        // countdown timer for auto-next

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  if (!mediaId) { showError("No title selected. Go back and pick something to watch."); return; }

  // Restore saved progress before loading details
  const saved = progressGet(mediaId, mediaType);
  if (saved) {
    savedTimestamp = saved.timestamp || 0;
    if (mediaType === "tv") {
      currentSeason  = saved.season  || 1;
      currentEpisode = saved.episode || 1;
    }
  }

  setupSourceButtons();
  setupSearchNav();
  setupPostMessageListener();

  if (mediaType === "tv") {
    document.getElementById("episode-bar").classList.remove("hidden");
    await loadTVDetails();
  } else {
    await loadMovieDetails();
  }

  loadSimilar();
  setupPageUnloadSave();
});

// ─── MOVIE ────────────────────────────────────────────────────────────────────
async function loadMovieDetails() {
  let movie, credits;
  try {
    [movie, credits] = await Promise.all([
      fetch(`${WATCH_TMDB}/movie/${mediaId}?api_key=${WATCH_API_KEY}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch(`${WATCH_TMDB}/movie/${mediaId}/credits?api_key=${WATCH_API_KEY}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    ]);
  } catch {
    showError("⚠ Couldn't load movie details. Check your connection and try again.");
    return;
  }
  document.title = `${movie.title} — StreamVault`;
  renderDetails(movie, credits);
  saveProgress({ title: movie.title, poster_path: movie.poster_path, year: (movie.release_date || "").slice(0, 4) });
  loadPlayer();
}

// ─── TV ───────────────────────────────────────────────────────────────────────
async function loadTVDetails() {
  let show, credits;
  try {
    [show, credits] = await Promise.all([
      fetch(`${WATCH_TMDB}/tv/${mediaId}?api_key=${WATCH_API_KEY}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch(`${WATCH_TMDB}/tv/${mediaId}/credits?api_key=${WATCH_API_KEY}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    ]);
  } catch {
    showError("⚠ Couldn't load show details. Check your connection and try again.");
    return;
  }
  document.title = `${show.name} — StreamVault`;
  totalSeasons = show.number_of_seasons || 1;
  if (show.episode_run_time && show.episode_run_time.length > 0) {
    mediaDuration = show.episode_run_time[0] * 60;
  } else if (show.runtime) {
    mediaDuration = show.runtime * 60;
  }
  (show.seasons || []).forEach(s => {
    if (s.season_number > 0) episodeCounts[s.season_number] = s.episode_count;
  });
  renderDetails(show, credits);
  saveProgress({ title: show.name, poster_path: show.poster_path, year: (show.first_air_date || "").slice(0, 4) });
  buildSeasonSelect();
  await loadEpisodeNames(currentSeason);
  buildEpisodeSelect();
  setupEpisodeNav();
  loadPlayer();
}

async function loadEpisodeNames(season) {
  if (episodeNames[season]) return;
  try {
    const res  = await fetch(`${WATCH_TMDB}/tv/${mediaId}/season/${season}?api_key=${WATCH_API_KEY}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    episodeNames[season] = {};
    (data.episodes || []).forEach(ep => {
      episodeNames[season][ep.episode_number] = ep.name || `Episode ${ep.episode_number}`;
    });
  } catch {
    // Non-critical — episode names just won't show; selects still work
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
    loadPlayer();
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
  sel.onchange = () => { currentEpisode = parseInt(sel.value); updateEpDisplay(); loadPlayer(); };
}

function setupEpisodeNav() {
  const autoNextBtn = document.getElementById("autonext-toggle");
  autoNextBtn.onclick = () => {
    autoNextEnabled = !autoNextEnabled;
    autoNextBtn.textContent = autoNextEnabled ? "Auto-Next: ON" : "Auto-Next: OFF";
    autoNextBtn.classList.toggle("active", autoNextEnabled);
    if (!autoNextEnabled && autoNextTimer) {
      clearTimeout(autoNextTimer);
      autoNextTimer = null;
      const existing = document.getElementById("autonext-banner");
      if (existing) existing.remove();
    } else if (autoNextEnabled && mediaType === "tv") {
      scheduleAutoNext();
    }
  };

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

  loading.classList.remove("hidden");
  iframe.classList.add("hidden");
  iframe.src = "about:blank";
  clearInterval(progressTimer);

  const url = mediaType === "tv"
    ? src.tv(mediaId, currentSeason, currentEpisode)
    : src.movie(mediaId);

  if (mediaType === "tv") {
    updateEpDisplay();
    saveProgress({});  // update season/episode immediately on episode change
  }

  // Show resume banner if we have a saved timestamp (movies only — TV resumes via season/ep)
  if (mediaType === "movie" && savedTimestamp > 30) {
    showResumeBanner(savedTimestamp);
  }

  setTimeout(() => {
    iframe.src = url;
    iframe.classList.remove("hidden");
    loading.classList.add("hidden");

    // Best-effort: attempt postMessage seek after embed loads
    if (mediaType === "movie" && savedTimestamp > 30) {
      attemptSeek(iframe, savedTimestamp);
    }

    // Poll progress every 15s via postMessage (embed may ignore — that's fine)
    progressTimer = setInterval(() => {
      try { iframe.contentWindow.postMessage({ type: "getProgress" }, "*"); } catch { }
    }, 15000);

    // Auto-next: schedule after a fixed duration estimate for TV (fallback since embeds block events)
    if (mediaType === "tv" && autoNextEnabled) {
      scheduleAutoNext();
    }
  }, 500);
}

// ─── AUTO-NEXT ────────────────────────────────────────────────────────────────
function scheduleAutoNext() {
  if (autoNextTimer) { clearTimeout(autoNextTimer); autoNextTimer = null; }
  const existing = document.getElementById("autonext-banner");
  if (existing) existing.remove();

  // Use known duration or fall back to 42-minute TV episode estimate
  const epDuration = mediaDuration > 60 ? mediaDuration : 42 * 60;
  // Show the countdown banner 30s before the estimated end
  const showBannerIn = Math.max((epDuration - 30) * 1000, 5000);

  autoNextTimer = setTimeout(() => {
    if (!autoNextEnabled) return;
    showAutoNextBanner();
  }, showBannerIn);
}

function showAutoNextBanner() {
  const existing = document.getElementById("autonext-banner");
  if (existing) existing.remove();

  const maxEp      = episodeCounts[currentSeason] || 1;
  const hasNext    = currentEpisode < maxEp || currentSeason < totalSeasons;
  if (!hasNext) return;

  let countdown = 10;
  const banner  = document.createElement("div");
  banner.id     = "autonext-banner";

  const render = () => {
    banner.innerHTML = `
      <span>▶ Next episode in <strong>${countdown}s</strong></span>
      <button id="autonext-now">Play Now</button>
      <button id="autonext-cancel">Cancel</button>`;
    document.getElementById("autonext-now").onclick    = () => { clearInterval(tick); banner.remove(); goNextEpisode(); };
    document.getElementById("autonext-cancel").onclick = () => { clearInterval(tick); banner.remove(); };
  };

  render();
  document.getElementById("player-wrap")?.prepend(banner);

  const tick = setInterval(() => {
    countdown--;
    if (countdown <= 0) { clearInterval(tick); banner.remove(); goNextEpisode(); return; }
    render();
  }, 1000);
}

async function goNextEpisode() {
  const maxEp = episodeCounts[currentSeason] || 1;
  if (currentEpisode < maxEp) { currentEpisode++; }
  else if (currentSeason < totalSeasons) { currentSeason++; currentEpisode = 1; }
  else { return; } // already at last episode
  await syncEpisodeSelects();
  loadPlayer();
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
  const grid = document.getElementById("similar-grid");
  let items  = [];

  try {
    const res  = await fetch(`${WATCH_TMDB}/${mediaType}/${mediaId}/similar?api_key=${WATCH_API_KEY}&page=1`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    items = (data.results || []).filter(i => i.poster_path).slice(0, 12);
  } catch {
    // Non-critical — just hide the section silently
    grid.closest(".similar-section").style.display = "none";
    return;
  }

  if (!items.length) {
    grid.closest(".similar-section").style.display = "none";
    return;
  }

  items.forEach(item => {
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

// ─── SEARCH NAV ──────────────────────────────────────────────────────────────
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
      try {
        const res  = await fetch(`${WATCH_TMDB}/search/multi?api_key=${WATCH_API_KEY}&query=${encodeURIComponent(q)}&page=1`);
        if (!res.ok) throw new Error();
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
      } catch {
        dropdown.classList.add("hidden");
      }
    }, 350);
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".search-wrap")) dropdown.classList.add("hidden");
  });
}

// ─── PROGRESS SAVE ────────────────────────────────────────────────────────────
function saveProgress(extra) {
  progressSave(mediaId, mediaType, {
    season:    mediaType === "tv" ? currentSeason  : undefined,
    episode:   mediaType === "tv" ? currentEpisode : undefined,
    timestamp: savedTimestamp,
    duration:  mediaDuration,
    ...extra,
  });
}

function setupPageUnloadSave() {
  window.addEventListener("pagehide", saveProgress);
  window.addEventListener("beforeunload", saveProgress);
}

// ─── RESUME BANNER ────────────────────────────────────────────────────────────
function showResumeBanner(ts) {
  const existing = document.getElementById("resume-banner");
  if (existing) existing.remove();

  const mins = Math.floor(ts / 60);
  const secs = String(Math.floor(ts % 60)).padStart(2, "0");
  const banner = document.createElement("div");
  banner.id = "resume-banner";
  banner.innerHTML = `
    <span>▶ Resume from ${mins}:${secs}?</span>
    <button id="resume-yes">Resume</button>
    <button id="resume-no">Start Over</button>`;
  document.getElementById("player-wrap")?.prepend(banner);

  document.getElementById("resume-yes").onclick = () => {
    attemptSeek(document.getElementById("player-iframe"), ts);
    banner.remove();
  };
  document.getElementById("resume-no").onclick = () => {
    savedTimestamp = 0;
    banner.remove();
  };

  // Auto-dismiss after 10s
  setTimeout(() => banner?.remove(), 10000);
}

// ─── POSTMESSAGE SEEK ─────────────────────────────────────────────────────────
function attemptSeek(iframe, ts) {
  // Try multiple message formats used by common embed players
  const msgs = [
    { type: "seek",        time: ts },
    { event: "seek",       seconds: ts },
    { method: "seek",      value: ts },
    { action: "seekTo",    time: ts },
  ];
  try {
    msgs.forEach(m => iframe.contentWindow.postMessage(m, "*"));
    iframe.contentWindow.postMessage(JSON.stringify({ event: "seek", seconds: ts }), "*");
  } catch { /* cross-origin block — silently ignored */ }
}

// ─── POSTMESSAGE LISTENER ─────────────────────────────────────────────────────
function setupPostMessageListener() {
  window.addEventListener("message", e => {
    const d = e.data;
    if (!d) return;

    // Parse string payloads
    let data = d;
    if (typeof d === "string") {
      try { data = JSON.parse(d); } catch { return; }
    }

    // Capture current time from various player event shapes
    const ct = data.currentTime ?? data.time ?? data.position ?? data.seconds;
    if (typeof ct === "number" && ct > 0) savedTimestamp = ct;

    // Capture duration
    const dur = data.duration ?? data.totalTime;
    if (typeof dur === "number" && dur > 0) {
      const wasUnknown = mediaDuration === 0;
      mediaDuration = dur;
      // If we just learned the real duration and auto-next is on, reschedule more accurately
      if (wasUnknown && mediaType === "tv" && autoNextEnabled) {
        scheduleAutoNext();
      }
    }
  });
}

// ─── ERROR ────────────────────────────────────────────────────────────────────
function showError(msg) {
  const playerWrap = document.getElementById("player-wrap");
  if (playerWrap) playerWrap.innerHTML = `<div class="error-msg">${msg}</div>`;
}
