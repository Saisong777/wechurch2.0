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
  document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#151819' : '#F7F8FC');
  var reading = {};
  try { reading = JSON.parse(localStorage.getItem('wechurch-reading-preferences') || '{}') || {}; } catch (_) {}
  var sizes = { compact: 100, standard: 112.5, large: 125, extra: 150, maximum: 225 };
  var size = Object.prototype.hasOwnProperty.call(sizes, reading.size) ? reading.size : 'standard';
  document.documentElement.dataset.textSize = size;
  document.documentElement.dataset.readingFont = reading.font === 'serif' ? 'serif' : 'sans';
  document.documentElement.style.fontSize = sizes[size] + '%';
})();
