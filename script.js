const API_KEY = "e9bb455fd0a77ed6738fa3e7826b4ee9";

const moviesEl = document.getElementById("movies");
const searchInput = document.getElementById("search");

// Load trending movies
function loadMovies(url) {
  fetch(url)
    .then(res => res.json())
    .then(data => {
      moviesEl.innerHTML = "";
      data.results.forEach(movie => {
        moviesEl.innerHTML += `
          <div class="movie" onclick="goToMovie(${movie.id})">
            <img src="https://image.tmdb.org/t/p/w500${movie.poster_path}">
          </div>
        `;
      });
    });
}

// Go to movie page
function goToMovie(id) {
  window.location.href = `movie.html?id=${id}`;
}

// Trending by default
loadMovies(`https://api.themoviedb.org/3/trending/movie/week?api_key=${API_KEY}`);

// Search
searchInput.addEventListener("keyup", e => {
  const query = e.target.value;

  if (query.length > 2) {
    loadMovies(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${query}`);
  }
});
