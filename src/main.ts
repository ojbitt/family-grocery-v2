import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './styles/tokens.css';
import App from './App.vue';
import { router } from './router';

createApp(App).use(createPinia()).use(router).mount('#app');

// Register the service worker where supported; ignore environments that block it
// (private windows, embedded webviews, some corporate policies).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // skipWaiting + clientsClaim (see vite.config.ts) mean a new deploy's worker
  // takes over an open tab automatically; reload once so it actually serves
  // the new build instead of the one already loaded in memory.
  //
  // Settings' "Check for updates" also unregisters the worker and reloads
  // manually, which makes a fresh worker claim this (already-current) page
  // right after — that would fire this same event and reload a second time
  // for no reason, so it flags that reload via sessionStorage to skip this one.
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    if (sessionStorage.getItem('grocery:manualReload')) {
      sessionStorage.removeItem('grocery:manualReload');
      return;
    }
    location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      /* offline install unavailable here; the app still works online */
    });
  });
}
