/* Cinematic logo-only opening, without session tracking or external requests.
   Story: signal -> reveal -> protective pulse -> arrival. */
(() => {
  'use strict';

  const splash = document.getElementById('ba-splash');
  if (!splash) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    splash.remove();
    return;
  }

  // Lightweight drifting sparks. They exist only while the intro is visible.
  const stars = document.getElementById('ba-splash-stars');
  if (stars && typeof document.createElement === 'function') {
    for (let i = 0; i < 24; i += 1) {
      const star = document.createElement('span');
      const unit = (seed) => (Math.sin(seed * 17.231 + 9.73) * 43758.5453) % 1;
      const random = (seed) => Math.abs(unit(seed));
      const set = (key, value) => star.style.setProperty(key, value);
      set('--x', (7 + random(i + 1) * 86).toFixed(1) + '%');
      set('--y', (8 + random(i + 40) * 80).toFixed(1) + '%');
      set('--size', (1.5 + random(i + 82) * 3).toFixed(1) + 'px');
      set('--dx', ((random(i + 122) - .5) * 160).toFixed(0) + 'px');
      set('--dy', ((random(i + 162) - .5) * 180).toFixed(0) + 'px');
      set('--delay', (0.15 + random(i + 202) * 1.6).toFixed(2) + 's');
      set('--dur', (1.6 + random(i + 242) * 1.9).toFixed(2) + 's');
      stars.appendChild(star);
    }
  }

  let done = false;
  const dismiss = () => {
    if (done) return;
    done = true;
    if (splash.isConnected) splash.remove();
    document.removeEventListener('keydown', onKeyDown);
  };
  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      window.clearTimeout(timer);
      dismiss();
    }
  };

  // Fallback cleanup still runs if CSS animations are unsupported or throttled.
  const timer = window.setTimeout(dismiss, 4150);
  splash.addEventListener('click', () => {
    window.clearTimeout(timer);
    dismiss();
  });
  document.addEventListener('keydown', onKeyDown);
})();
