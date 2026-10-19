// Saved look at first paint, no «scuro» flash (released on load). Colours: [theme-color, --bg].
((d, s, T) => {
  try { s = JSON.parse(localStorage.getItem('mappeora-settings')).state || {}; } catch {}
  var D = d.dataset, S = d.style, n = s.textScale, k = T.hasOwnProperty(s.theme) && s.theme, c = T[k || 'crema'], m = d.querySelector('[name=theme-color]');
  if (k) D.theme = k;
  if (/^(lexend|atkinson|opendyslexic|sistema)$/.test(s.font)) D.font = s.font;
  if (s.uppercase === !!s.uppercase) D.uppercase = '' + s.uppercase;
  if (s.wideSpacing === !!s.wideSpacing) D.spacing = s.wideSpacing ? 'wide' : 'normal';
  if (n === +n && n >= 0.8 && n <= 3) S.setProperty('--text-scale', n);
  if (m) m.content = c[0];
  S.background = c[1];
  S.colorScheme = k == 'scuro' ? 'dark' : '';
  addEventListener('load', () => S.background = S.colorScheme = '');
})(document.documentElement, {}, {
  crema: ['#fffdf7', '#fdf8ec'], bianco: ['#fff', '#fff'], azzurro: ['#f6fafe', '#eaf3fb'], scuro: ['#282d38', '#1d2129']
});
