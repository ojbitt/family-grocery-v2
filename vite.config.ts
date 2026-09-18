import { execSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

function gitShortSha(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD').toString().trim();
    const dirty = execSync('git status --porcelain').toString().trim().length > 0;
    return dirty ? `${sha}+dirty` : sha;
  } catch {
    return 'unknown';
  }
}

// Identifies exactly which build is running — shown in Settings so you can
// confirm a device actually picked up the latest deploy (see "Check for
// updates"). The timestamp is the part that reliably changes between deploys
// here (this project often ships uncommitted work, so the SHA alone
// sometimes wouldn't), but the SHA still pins down the exact source tree.
const APP_VERSION = `${gitShortSha()} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

// The SPA is built to ./dist and served by the Worker's [assets] binding in production.
// In dev, Vite serves the app and proxies /api to a local `wrangler dev` on :8787.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered manually in src/main.ts (with a catch)
      manifest: false, // using public/manifest.webmanifest
      includeAssets: ['manifest.webmanifest', 'icons/*.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
        cleanupOutdatedCaches: true,
        // Without this, a new deploy's service worker installs but sits in
        // "waiting" until every open tab is fully closed, so a reload alone
        // keeps serving the previous build indefinitely.
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
});
