(function () {
  var saved = null;
  try {
    saved = localStorage.getItem('box-theme');
  } catch (error) {}
  var dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
