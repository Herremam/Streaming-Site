// ─── CONFIG ───────────────────────────────────────────────────────────────────
const SEARCH_API_KEY = "e9bb455fd0a77ed6738fa3e7826b4ee9";
const SEARCH_TMDB    = "https://api.themoviedb.org/3";
const SEARCH_IMG     = "https://image.tmdb.org/t/p/";

// ─── STATE ────────────────────────────────────────────────────────────────────
const urlParams   = new URLSearchParams(window.location.search);
let searchQuery   = decodeURIComponent(urlParams.get("q") || "");
let searchType    = "multi"; // multi | movie | tv
let searchPage    = 1;
let totalPages    = 1;

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("search");
  if (input && searchQuery) input.value = searchQuery;

  setupTypeToggle();
  setupSearchInput();
  setupLoadMore();

  if (searchQuery) {
    runSearch(true);
  } else {
    document.getElementById("search-heading").textContent = "Search for something above";
  }
});

// ─── TYPE TOGGLE ──────────────────────────────────────────────────────────────
function setupTypeToggle() {
  document.querySelectorAll(".search-type-toggle .tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".search-type-toggle .tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      searchType = btn.dataset.type;
      searchPage = 1;
      runSearch(true);
    });
  });
}

// ─── SEARCH INPUT (Enter key or typing navigates) ────────────────────────────
function setupSearchInput() {
  const input    = document.getElementById("search");
  const dropdown = document.getElementById("search-results");
  if (!input) return;

  input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      const q = input.value.trim();
      if (q) {
        searchQuery = q;
        searchPage  = 1;
        history.replaceState(null, "", `search.html?q=${encodeURIComponent(q)}`);
        runSearch(true);
        dropdown.classList.add("hidden");
      }
    }
  });

  let debounce;
  input.addEventListener("input", () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    if (!q) { dropdown.classList.add("hidden"); return; }
    debounce = setTimeout(async () => {
      const res  = await fetch(`${SEARCH_TMDB}/search/multi?api_key=${SEARCH_API_KEY}&query=${encodeURIComponent(q)}&page=1`);
      const data = await res.json();
      const results = (data.results || []).filter(r => r.media_type !== "person" && r.poster_path).slice(0, 5);
      if (!results.length) { dropdown.classList.add("hidden"); return; }
      dropdown.innerHTML = results.map(item => {
        const t = item.title || item.name || "";
        const y = (item.release_date || item.first_air_date || "").slice(0, 4);
        return `<div class="sr-item" data-id="${item.id}" data-type="${item.media_type === 'tv' ? 'tv' : 'movie'}">
          <img src="${SEARCH_IMG}w92${item.poster_path}" alt="${t}" />
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

// ─── SEARCH ───────────────────────────────────────────────────────────────────
async function runSearch(reset = true) {
  if (!searchQuery) return;

  const grid    = document.getElementById("results-grid");
  const noRes   = document.getElementById("no-results");
  const loadBtn = document.getElementById("load-more");

  if (reset) {
    grid.innerHTML = "";
    noRes.classList.add("hidden");
    loadBtn.classList.add("hidden");
    searchPage = 1;
    showSkeletons(grid, 12);
  }

  document.getElementById("search-heading").textContent =
    `Results for "${searchQuery}"`;
  document.title = `"${searchQuery}" — StreamVault`;

  // Build URL: multi-search or typed search
  const type = searchType === "multi" ? "multi" : searchType;
  const url  = `${SEARCH_TMDB}/search/${type}?api_key=${SEARCH_API_KEY}&query=${encodeURIComponent(searchQuery)}&page=${searchPage}&include_adult=false`;

  const res  = await fetch(url);
  const data = await res.json();
  totalPages = data.total_pages || 1;

  grid.querySelectorAll(".card.skeleton").forEach(s => s.remove());

  const items = (data.results || []).filter(item => {
    if (!item.poster_path) return false;
    if (searchType === "multi") return item.media_type === "movie" || item.media_type === "tv";
    return true;
  });

  if (reset && items.length === 0) {
    noRes.classList.remove("hidden");
    return;
  }

  items.forEach((item, i) => {
    const mediaType = item.media_type || searchType;
    const title     = item.title || item.name || "";
    const year      = (item.release_date || item.first_air_date || "").slice(0, 4);
    const rating    = item.vote_average ? item.vote_average.toFixed(1) : "N/A";
    const typeBadge = mediaType === "tv" ? "TV" : "Movie";

    const card = document.createElement("div");
    card.className = "card";
    card.style.animationDelay = `${(i % 12) * 0.04}s`;
    card.innerHTML = `
      <div class="card-img-wrap">
        <img src="${SEARCH_IMG}w342${item.poster_path}" alt="${title}" loading="lazy" />
        <div class="card-overlay">
          <button class="btn-play">▶</button>
          <div class="card-rating">★ ${rating}</div>
        </div>
        <div class="card-type-badge">${typeBadge}</div>
      </div>
      <div class="card-info">
        <p class="card-title">${title}</p>
        <span class="card-year">${year}</span>
      </div>`;
    card.onclick = () => { window.location.href = `movie.html?id=${item.id}&type=${mediaType === 'tv' ? 'tv' : 'movie'}`; };
    grid.appendChild(card);
  });

  // Show load more if there are more pages
  if (searchPage < totalPages) {
    loadBtn.classList.remove("hidden");
  } else {
    loadBtn.classList.add("hidden");
  }

  searchPage++;
}

function setupLoadMore() {
  document.getElementById("load-more").addEventListener("click", () => runSearch(false));
}

function showSkeletons(grid, count) {
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "card skeleton";
    grid.appendChild(el);
  }
}
