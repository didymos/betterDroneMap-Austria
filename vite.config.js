import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // CORS-Fallback: Dev-Server leitet /proxy an server/proxy.mjs (npm run proxy) weiter.
    proxy: { '/proxy': 'http://127.0.0.1:8787' },
  },
  test: { environment: 'node', include: ['test/**/*.test.js'] },
});
