(function () {
  var STORAGE_KEY = "sv_disclaimer_accepted";

  if (localStorage.getItem(STORAGE_KEY)) return;

  var banner = document.createElement("div");
  banner.id = "disclaimer-banner";
  banner.innerHTML = [
    '<div class="db-inner">',
    '  <div class="db-icon">⚠</div>',
    '  <div class="db-text">',
    '    <strong>Important Notice</strong>',
    '    <p>Do not watch any content on this site. The content displayed here is likely illegally imported from secondary third-party sources. By continuing to browse, you acknowledge this warning and accept all responsibility for your actions.</p>',
    '  </div>',
    '  <button class="db-btn" id="db-accept">I Understand</button>',
    '  <button class="db-close" id="db-close" aria-label="Close">✕</button>',
    "</div>",
  ].join("");

  document.body.appendChild(banner);

  function dismiss() {
    banner.classList.add("db-hiding");
    setTimeout(function () {
      banner.remove();
    }, 400);
    localStorage.setItem(STORAGE_KEY, "1");
  }

  document.getElementById("db-accept").addEventListener("click", dismiss);
  document.getElementById("db-close").addEventListener("click", dismiss);

  setTimeout(function () {
    banner.classList.add("db-visible");
  }, 300);
})();
