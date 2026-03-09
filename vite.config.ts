import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        icon: 'https://vitejs.dev/logo.svg',
        namespace: 'npm/vite-plugin-monkey',
        match: ['*://*/*'],
        grant: ["GM_xmlhttpRequest"],
        require: [
          "https://unpkg.com/@popperjs/core@2/dist/umd/popper.min.js",
          "https://cdn.jsdelivr.net/npm/interactjs/dist/interact.min.js"
        ],
        connect: ["localhost"]
      },
    }),
  ],
});
