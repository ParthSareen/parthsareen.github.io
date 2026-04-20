(function () {
  const root = document.documentElement;

  let stored = null;
  try { stored = localStorage.getItem('theme'); } catch (_) {}

  root.dataset.theme = stored || 'light';

  function labelFor(current) {
    return current === 'dark' ? 'light' : 'dark';
  }

  function mountToggle() {
    const foot = document.querySelector('.site-foot-right');
    if (!foot || foot.querySelector('.theme-toggle')) return;

    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle color theme');
    btn.setAttribute('aria-pressed', root.dataset.theme === 'dark');
    btn.textContent = labelFor(root.dataset.theme);

    btn.addEventListener('click', function () {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (_) {}
      btn.setAttribute('aria-pressed', next === 'dark');
      btn.textContent = labelFor(next);
    });

    foot.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountToggle);
  } else {
    mountToggle();
  }
})();
