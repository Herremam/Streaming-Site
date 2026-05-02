// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_KEY = "e9bb455fd0a77ed6738fa3e7826b4ee9"; // TMDB key
const TMDB    = "https://api.themoviedb.org/3";
const IMG     = "https://image.tmdb.org/t/p/";

// ─── STATE ────────────────────────────────────────────────────────────────────
let currentTab    = "movies"; // "movies" | "tv"
let currentGenre  = "";
let currentPage   = 1;
let currentSearch = "";
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
      currentSearch = "";
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
      currentSearch = "";
      loadPage(true);
    });
  });
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────
function setupSearch() {
  const input   = document.getElementById("search");
  const dropdown = document.getElementById("search-results");
  if (!input) return;

  let debounce;
  input.addEventListener("input", () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    if (!q) { dropdown.classList.add("hidden"); return; }
    debounce = setTimeout(() => fetchSearch(q, dropdown), 350);
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".search-wrap")) dropdown.classList.add("hidden");
  });
}

async function fetchSearch(q, dropdown) {
  const type = currentTab === "movies" ? "movie" : "tv";
  const res  = await fetch(`${TMDB}/search/${type}?api_key=${API_KEY}&query=${encodeURIComponent(q)}&page=1`);
  const data = await res.json();
  const results = (data.results || []).slice(0, 6);

  if (!results.length) { dropdown.classList.add("hidden"); return; }

  dropdown.innerHTML = results.map(item => {
    const title = item.title || item.name || "";
    const year  = (item.release_date || item.first_air_date || "").slice(0, 4);
    const poster = item.poster_path ? `${IMG}w92${item.poster_path}` : "";
    return `<div class="sr-item" data-id="${item.id}">
      ${poster ? `<img src="${poster}" alt="${title}" />` : '<div class="sr-no-img"></div>'}
      <div><strong>${title}</strong><span>${year}</span></div>
    </div>`;
  }).join("");

  dropdown.classList.remove("hidden");
  dropdown.querySelectorAll(".sr-item").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.dataset.id;
      window.location.href = `movie.html?id=${id}&type=${type}`;
    });
  });
}

// ─── LOAD PAGE ────────────────────────────────────────────────────────────────
async function loadPage(reset = false) {
  const grid = document.getElementById("movies");
  if (reset) { grid.innerHTML = ""; currentPage = 1; }

  showGridSkeleton(grid, reset);

  const type = currentTab === "movies" ? "movie" : "tv";
  let url;

  if (currentSearch) {
    url = `${TMDB}/search/${type}?api_key=${API_KEY}&query=${encodeURIComponent(currentSearch)}&page=${currentPage}`;
  } else if (currentGenre) {
    url = `${TMDB}/discover/${type}?api_key=${API_KEY}&with_genres=${currentGenre}&sort_by=popularity.desc&page=${currentPage}`;
  } else {
    url = `${TMDB}/trending/${type}/week?api_key=${API_KEY}&page=${currentPage}`;
  }

  const res  = await fetch(url);
  const data = await res.json();
  const items = data.results || [];

  // Remove skeletons
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

  document.getElementById("hero-bg").style.backgroundImage =
    `url('${IMG}original${item.backdrop_path}')`;
  document.getElementById("hero-title").textContent = title;
  document.getElementById("hero-desc").textContent  = desc;
  document.getElementById("hero-meta").innerHTML =
    `${year ? `<span>${year}</span>` : ""}
     ${rating ? `<span class="rating">★ ${rating}</span>` : ""}`;

  const btn = document.getElementById("hero-btn");
  btn.onclick = () => window.location.href = `movie.html?id=${item.id}&type=${type}`;
}

// ─── SKELETON ─────────────────────────────────────────────────────────────────
function showGridSkeleton(grid, reset) {
  if (!reset) return;
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

    const card = document.createElement("div");
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

    card.addEventListener("click", () => {
      window.location.href = `movie.html?id=${item.id}&type=${type}`;
    });

    grid.appendChild(card);
  });
}

// ─── LOAD MORE ────────────────────────────────────────────────────────────────
function setupLoadMore() {
  const btn = document.getElementById("load-more");
  if (btn) btn.addEventListener("click", () => loadPage(false));
}
