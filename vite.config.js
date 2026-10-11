import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';


/**
 * Inline the built CSS into index.html.
 *
 * The stylesheet is ~7 kB (≈2 kB brotli) and blocks first paint, so serving it
 * as a separate file costs a full round trip on slow connections. Inlining it
 * removes that request from the critical path; the emitted .css file is kept in
 * the bundle so the service worker's precache manifest stays complete.
 */
function inlineCriticalCss() {
  return {
    name: 'kf-inline-critical-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle || {};
        const cssFile = Object.values(bundle).find(
          (chunk) => chunk.type === 'asset' && chunk.fileName.endsWith('.css')
        );
        if (!cssFile) return html;
        const href = `/${cssFile.fileName}`;
        const link = new RegExp(`<link[^>]+href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`);
        if (!link.test(html)) return html;
        const css = String(cssFile.source || '').replace(/<\/style>/g, '<\\/style>');
        return html.replace(link, `<style>${css}</style>`);
      },
    },
  };
}

export default defineConfig({
  plugins: [
    inlineCriticalCss(),
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      manifest: false,
      // SW registration is handled manually in src/main.jsx (Section 4.4).
      injectRegister: null,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: true,
    allowedHosts: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          utils: ['uuid'],
        },
      },
    },
    target: 'es2020',
  },
  envPrefix: 'VITE_',
});
