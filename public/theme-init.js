// Apply the saved appearance before styles and the app load, including OAuth returns.
(function () {
  var theme = 'light';
  try {
    var saved = localStorage.getItem('wechurch-theme');
    if (saved === 'dark' || saved === 'light' || saved === 'system') theme = saved;
    else if (saved) localStorage.removeItem('wechurch-theme');
  } catch (_) { /* Storage can be unavailable in private browsers. */ }
  var dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.add(dark ? 'dark' : 'light');
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#151819' : '#F8FAF9');
})();
