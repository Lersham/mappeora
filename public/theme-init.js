// Saved look before the first paint (no white flash for «scuro»). Mirrors useApplySettings in App.tsx.
(function (d, s, T) {
  try { s = JSON.parse(localStorage.getItem('mappeora-settings')).state || {}; } catch (e) {}
  var D = d.dataset, S = d.style, n = s.textScale, k = T.hasOwnProperty(s.theme), c = T[k ? s.theme : 'crema'], m = document.querySelector('[name=theme-color]');
  if (k) D.theme = s.theme;
  if (/^(lexend|atkinson|opendyslexic|sistema)$/.test(s.font)) D.font = s.font;
  if (typeof s.uppercase == 'boolean') D.uppercase = '' + s.uppercase;
  if (typeof s.wideSpacing == 'boolean') D.spacing = s.wideSpacing ? 'wide' : 'normal';
  if (typeof n == 'number' && n >= 0.8 && n <= 3) S.setProperty('--text-scale', n);
  if (m) m.content = c[0];
  // Only until the CSS is in, then body's var(--bg) takes over.
  S.background = c[1];
  S.colorScheme = s.theme == 'scuro' ? 'dark' : 'light';
  addEventListener('load', function () { S.background = S.colorScheme = ''; });
})(document.documentElement, {}, {
  crema: ['#fffdf7', '#fdf8ec'], bianco: ['#fff', '#fff'], azzurro: ['#f6fafe', '#eaf3fb'], scuro: ['#282d38', '#1d2129'] // theme-color, --bg
});
