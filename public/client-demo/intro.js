/* Bantay-Agapay logo-only opening. Replays on every page load, including hard refresh. */
(() => {
  'use strict';
  const splash = document.getElementById('ba-splash');
  if (!splash) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    splash.remove();
    return;
  }

  const removeSplash = () => {
    if (splash.isConnected) splash.remove();
  };

  const timer = window.setTimeout(removeSplash, 1900);

  // The only visible element is the logo. Click/tap anywhere or press Escape to skip.
  splash.addEventListener('click', () => {
    window.clearTimeout(timer);
    removeSplash();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      window.clearTimeout(timer);
      removeSplash();
    }
  });
})();
