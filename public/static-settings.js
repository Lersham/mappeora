// Gives the static pages that load it (crediti, presentazione) the look the child chose in
// the app: colours, text size, spacing, capitals. It only reads what the app saved on
// this device ('mappeora-settings') and sends nothing anywhere. If anything is missing
// or odd, the page keeps its own style. Same values as theme.css and settingsStore.ts.
//
// Fonts: the font files are bundled by the app with hashed names, so they are not
// available here. The stacks below use the font if the device has it installed and
// otherwise fall back to the system font.
(function () {
  var SYSTEM = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  var THEMES = {
    crema: { '--bg': '#fdf8ec', '--card': '#fffdf7', '--text': '#1f2a36', '--muted': '#4b5866', '--accent': '#2b54b0', '--accent-text': '#ffffff', '--line': '#e4dccb' },
    bianco: { '--bg': '#ffffff', '--card': '#ffffff', '--text': '#1f2a36', '--muted': '#4b5866', '--accent': '#2b54b0', '--accent-text': '#ffffff', '--line': '#dcdfe3' },
    azzurro: { '--bg': '#eaf3fb', '--card': '#f6fafe', '--text': '#1f2a36', '--muted': '#4b5866', '--accent': '#2b54b0', '--accent-text': '#ffffff', '--line': '#d0dfec' },
    scuro: { '--bg': '#1d2129', '--card': '#282d38', '--text': '#f1ede4', '--muted': '#b5b9c2', '--accent': '#7fb0e6', '--accent-text': '#10161f', '--line': '#3d4451' },
  };
  var FONTS = {
    lexend: "'Lexend', " + SYSTEM,
    atkinson: "'Atkinson Hyperlegible', " + SYSTEM,
    opendyslexic: "'OpenDyslexic', " + SYSTEM,
    sistema: SYSTEM,
  };

  try {
    var raw = localStorage.getItem('mappeora-settings');
    var s = raw && JSON.parse(raw).state;
    if (!s || typeof s !== 'object') return;
    var root = document.documentElement;
    var has = Object.prototype.hasOwnProperty;

    if (typeof s.theme === 'string' && has.call(THEMES, s.theme)) {
      var theme = THEMES[s.theme];
      for (var name in theme) if (has.call(theme, name)) root.style.setProperty(name, theme[name]);
      root.style.colorScheme = s.theme === 'scuro' ? 'dark' : 'light';
      // The saved theme wins over the system's dark mode (the pages' media query asks for no data-theme).
      root.setAttribute('data-theme', s.theme);
    }
    if (typeof s.font === 'string' && has.call(FONTS, s.font)) root.style.setProperty('--font-body', FONTS[s.font]);
    if (typeof s.textScale === 'number' && s.textScale >= 0.8 && s.textScale <= 3) root.style.fontSize = 16 * s.textScale + 'px';
    if (s.wideSpacing === true) {
      root.style.setProperty('--letter-spacing', '0.04em');
      root.style.setProperty('--word-spacing', '0.12em');
      root.style.setProperty('--line-height', '1.6');
    }
    if (s.uppercase === true) root.style.textTransform = 'uppercase';
  } catch (e) {
    // Storage blocked or unreadable: nothing to apply.
  }
})();
