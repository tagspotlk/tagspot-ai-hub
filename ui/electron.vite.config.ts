import react from '@vitejs/plugin-react';
import { type Plugin, defineConfig } from 'electron-vite';

const PRODUCTION_CONNECT_SRC = "connect-src 'self'";
const DEV_CONNECT_SRC = `${PRODUCTION_CONNECT_SRC} ws://localhost:*`;

/** Vite's dev server needs a websocket for HMR; production builds never get it. */
const devOnlyHmrCsp: Plugin = {
  name: 'dev-only-hmr-csp',
  apply: 'serve',
  transformIndexHtml: (html) => {
    if (!html.includes(PRODUCTION_CONNECT_SRC))
      throw new Error('index.html CSP no longer contains the expected connect-src directive');
    return html.replace(PRODUCTION_CONNECT_SRC, DEV_CONNECT_SRC);
  },
};

export default defineConfig({
  main: {},
  // A sandboxed preload cannot be an ES module, so it is bundled as CommonJS.
  preload: {
    build: { rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } } },
  },
  renderer: { plugins: [react(), devOnlyHmrCsp] },
});
