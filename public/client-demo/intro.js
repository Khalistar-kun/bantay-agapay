/* Short, accessible logo intro. No requests, cookies or personal data. */
(() => {
  'use strict';
  const root = document.documentElement;
  const intro = document.getElementById('ba-intro');
  if (!intro || !root.classList.contains('ba-intro-enabled')) return;
  const skip = document.getElementById('ba-intro-skip');
  let closed = false;
  const dismiss = () => {
    if (closed) return;
    closed = true;
    root.classList.add('ba-intro-exiting');
    window.setTimeout(() => {
      root.classList.remove('ba-intro-enabled', 'ba-intro-exiting');
      intro.remove();
    }, 360);
  };
  try { sessionStorage.setItem('ba_intro_seen', '1'); } catch (_) {}
  const timer = window.setTimeout(dismiss, 2250);
  skip?.addEventListener('click', () => {
    window.clearTimeout(timer);
    dismiss();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      window.clearTimeout(timer);
      dismiss();
    }
  }, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      window.clearTimeout(timer);
      dismiss();
    }
  }, { once: true });
})();
