// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_KEY = "e9bb455fd0a77ed6738fa3e7826b4ee9";
const TMDB    = "https://api.themoviedb.org/3";
const IMG     = "https://image.tmdb.org/t/p/";

// ─── STATE ────────────────────────────────────────────────────────────────────
let currentTab    = "movies";
let currentGenre  = "";
let currentPage   = 1;
let heroItems     = [];
let heroIndex     = 0;
let heroTimer     = null;

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupGenres();
  setupSearch();
  setupLoadMore();
  loadPage(true);
});

// ─── TABS ─────────────────────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentTab   = btn.dataset.tab;
      currentPage  = 1;
      currentGenre = "";
      document.querySelectorAll(".genre-btn").forEach(b => b.classList.remove("active"));
      document.querySelector(".genre-btn[data-id='']").classList.add("active");
      document.getElementById("section-title").textContent =
        currentTab === "movies" ? "Trending Movies" : "Trending TV Shows";
      loadPage(true);
    });
  });
}

// ─── GENRES ───────────────────────────────────────────────────────────────────
function setupGenres() {
  document.querySelectorAll(".genre-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".genre-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentGenre = btn.dataset.id;
      currentPage  = 1;
      loadPage(true);
    });
  });
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────
function setupSearch() {
  const input    = document.getElementById("search");
  const dropdown = document.getElementById("search-results");
  if (!input) return;

  // Navigate to search page on Enter
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      const q = input.value.trim();
      if (q) window.location.href = `search.html?q=${encodeURIComponent(q)}`;
    }
  });

  // Quick-result dropdown while typing
  let debounce;
  input.addEventListener("input", () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    if (!q) { dropdown.classList.add("hidden"); return; }
    debounce = setTimeout(() => fetchDropdown(q, dropdown), 350);
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".search-wrap")) dropdown.classList.add("hidden");
  });
}

async function fetchDropdown(q, dropdown) {
  const type = currentTab === "movies" ? "movie" : "tv";
  const res  = await fetch(`${TMDB}/search/${type}?api_key=${API_KEY}&query=${encodeURIComponent(q)}&page=1`);
  const data = await res.json();
  const results = (data.results || []).filter(i => i.poster_path).slice(0, 6);

  if (!results.length) { dropdown.classList.add("hidden"); return; }

  dropdown.innerHTML = results.map(item => {
    const title = item.title || item.name || "";
    const year  = (item.release_date || item.first_air_date || "").slice(0, 4);
    return `<div class="sr-item" data-id="${item.id}" data-type="${type}">
      <img src="${IMG}w92${item.poster_path}" alt="${title}" />
      <div><strong>${title}</strong><span>${year}</span></div>
    </div>
    <div class="sr-footer" data-q="${encodeURIComponent(q)}">
      See all results for "<em>${q}</em>" →
    </div>`;
  }).join("").replace(/(<div class="sr-footer".*?<\/div>)\s*(<div class="sr-footer".*?<\/div>)/gs, '$1');

  // De-dupe the footer — just add one at the bottom
  const items = results.map(item => {
    const title = item.title || item.name || "";
    const year  = (item.release_date || item.first_air_date || "").slice(0, 4);
    return `<div class="sr-item" data-id="${item.id}" data-type="${type}">
      <img src="${IMG}w92${item.poster_path}" alt="${title}" />
      <div><strong>${title}</strong><span>${year}</span></div>
    </div>`;
  }).join("");

  dropdown.innerHTML = items + `<div class="sr-all" data-q="${encodeURIComponent(q)}">See all results for "<em>${q}</em>" →</div>`;
  dropdown.classList.remove("hidden");

  dropdown.querySelectorAll(".sr-item").forEach(el => {
    el.onclick = () => { window.location.href = `movie.html?id=${el.dataset.id}&type=${el.dataset.type}`; };
  });
  const allBtn = dropdown.querySelector(".sr-all");
  if (allBtn) {
    allBtn.onclick = () => { window.location.href = `search.html?q=${allBtn.dataset.q}`; };
  }
}

// ─── LOAD PAGE ────────────────────────────────────────────────────────────────
async function loadPage(reset = false) {
  const grid = document.getElementById("movies");
  if (reset) { grid.innerHTML = ""; currentPage = 1; showGridSkeleton(grid); }

  const type = currentTab === "movies" ? "movie" : "tv";
  const url  = currentGenre
    ? `${TMDB}/discover/${type}?api_key=${API_KEY}&with_genres=${currentGenre}&sort_by=popularity.desc&page=${currentPage}`
    : `${TMDB}/trending/${type}/week?api_key=${API_KEY}&page=${currentPage}`;

  const res  = await fetch(url);
  const data = await res.json();
  const items = data.results || [];

  grid.querySelectorAll(".card.skeleton").forEach(s => s.remove());
  if (reset && items.length > 0) setupHero(items);
  renderCards(items, grid, type);
  currentPage++;
}

// ─── HERO ─────────────────────────────────────────────────────────────────────
function setupHero(items) {
  heroItems = items.filter(i => i.backdrop_path).slice(0, 5);
  heroIndex = 0;
  clearInterval(heroTimer);
  renderHero(heroItems[0]);
  heroTimer = setInterval(() => {
    heroIndex = (heroIndex + 1) % heroItems.length;
    renderHero(heroItems[heroIndex]);
  }, 7000);
}

function renderHero(item) {
  const type   = currentTab === "movies" ? "movie" : "tv";
  const title  = item.title || item.name || "";
  const desc   = item.overview ? item.overview.slice(0, 200) + "…" : "";
  const rating = item.vote_average ? item.vote_average.toFixed(1) : "";
  const year   = (item.release_date || item.first_air_date || "").slice(0, 4);

  document.getElementById("hero-bg").style.backgroundImage = `url('${IMG}original${item.backdrop_path}')`;
  document.getElementById("hero-title").textContent = title;
  document.getElementById("hero-desc").textContent  = desc;
  document.getElementById("hero-meta").innerHTML =
    `${year   ? `<span>${year}</span>` : ""}
     ${rating ? `<span class="rating">★ ${rating}</span>` : ""}`;
  document.getElementById("hero-btn").onclick =
    () => window.location.href = `movie.html?id=${item.id}&type=${type}`;
}

// ─── SKELETON ─────────────────────────────────────────────────────────────────
function showGridSkeleton(grid) {
  for (let i = 0; i < 12; i++) {
    const el = document.createElement("div");
    el.className = "card skeleton";
    grid.appendChild(el);
  }
}

// ─── RENDER CARDS ─────────────────────────────────────────────────────────────
function renderCards(items, grid, type) {
  items.forEach((item, i) => {
    if (!item.poster_path) return;
    const title  = item.title || item.name || "";
    const year   = (item.release_date || item.first_air_date || "").slice(0, 4);
    const rating = item.vote_average ? item.vote_average.toFixed(1) : "N/A";
    const card   = document.createElement("div");
    card.className = "card";
    card.style.animationDelay = `${(i % 12) * 0.04}s`;
    card.innerHTML = `
      <div class="card-img-wrap">
        <img src="${IMG}w342${item.poster_path}" alt="${title}" loading="lazy" />
        <div class="card-overlay">
          <button class="btn-play">▶</button>
          <div class="card-rating">★ ${rating}</div>
        </div>
      </div>
      <div class="card-info">
        <p class="card-title">${title}</p>
        <span class="card-year">${year}</span>
      </div>`;
    card.onclick = () => { window.location.href = `movie.html?id=${item.id}&type=${type}`; };
    grid.appendChild(card);
  });
}

// ─── LOAD MORE ────────────────────────────────────────────────────────────────
function setupLoadMore() {
  const btn = document.getElementById("load-more");
  if (btn) btn.addEventListener("click", () => loadPage(false));
}
