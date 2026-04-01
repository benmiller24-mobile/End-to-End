// vite.config.js
import { defineConfig } from "file:///sessions/intelligent-kind-volta/mnt/Eclipse%20Kitchen%20Designer%20Layout%20Engine/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/intelligent-kind-volta/mnt/Eclipse%20Kitchen%20Designer%20Layout%20Engine/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "/sessions/intelligent-kind-volta/mnt/Eclipse Kitchen Designer Layout Engine/frontend";
var vite_config_default = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@engine": path.resolve(__vite_injected_original_dirname, "../eclipse-engine/src"),
      "@pricing": path.resolve(__vite_injected_original_dirname, "../eclipse-pricing/src"),
      // Stub Node-only modules for browser build (engine-3d.js uses these)
      "child_process": path.resolve(__vite_injected_original_dirname, "src/lib/node-stubs.js"),
      "url": path.resolve(__vite_injected_original_dirname, "src/lib/node-stubs.js"),
      "path": path.resolve(__vite_injected_original_dirname, "src/lib/node-stubs.js")
    }
  },
  server: {
    proxy: {
      "/api": "http://localhost:8888"
    },
    fs: {
      // Allow serving files from parent directories (engine + pricing modules)
      allow: [".."]
    }
  },
  base: "./",
  build: {
    outDir: "../dist",
    rollupOptions: {
      // Mark Node.js built-ins as external stubs
      external: []
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvaW50ZWxsaWdlbnQta2luZC12b2x0YS9tbnQvRWNsaXBzZSBLaXRjaGVuIERlc2lnbmVyIExheW91dCBFbmdpbmUvZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9pbnRlbGxpZ2VudC1raW5kLXZvbHRhL21udC9FY2xpcHNlIEtpdGNoZW4gRGVzaWduZXIgTGF5b3V0IEVuZ2luZS9mcm9udGVuZC92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvaW50ZWxsaWdlbnQta2luZC12b2x0YS9tbnQvRWNsaXBzZSUyMEtpdGNoZW4lMjBEZXNpZ25lciUyMExheW91dCUyMEVuZ2luZS9mcm9udGVuZC92aXRlLmNvbmZpZy5qc1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJ0BlbmdpbmUnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4vZWNsaXBzZS1lbmdpbmUvc3JjJyksXG4gICAgICAnQHByaWNpbmcnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4vZWNsaXBzZS1wcmljaW5nL3NyYycpLFxuICAgICAgLy8gU3R1YiBOb2RlLW9ubHkgbW9kdWxlcyBmb3IgYnJvd3NlciBidWlsZCAoZW5naW5lLTNkLmpzIHVzZXMgdGhlc2UpXG4gICAgICAnY2hpbGRfcHJvY2Vzcyc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvbGliL25vZGUtc3R1YnMuanMnKSxcbiAgICAgICd1cmwnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnc3JjL2xpYi9ub2RlLXN0dWJzLmpzJyksXG4gICAgICAncGF0aCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvbGliL25vZGUtc3R1YnMuanMnKSxcbiAgICB9XG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHByb3h5OiB7XG4gICAgICAnL2FwaSc6ICdodHRwOi8vbG9jYWxob3N0Ojg4ODgnXG4gICAgfSxcbiAgICBmczoge1xuICAgICAgLy8gQWxsb3cgc2VydmluZyBmaWxlcyBmcm9tIHBhcmVudCBkaXJlY3RvcmllcyAoZW5naW5lICsgcHJpY2luZyBtb2R1bGVzKVxuICAgICAgYWxsb3c6IFsnLi4nXVxuICAgIH1cbiAgfSxcbiAgYmFzZTogJy4vJyxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6ICcuLi9kaXN0JyxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAvLyBNYXJrIE5vZGUuanMgYnVpbHQtaW5zIGFzIGV4dGVybmFsIHN0dWJzXG4gICAgICBleHRlcm5hbDogW10sXG4gICAgfVxuICB9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBc2IsU0FBUyxvQkFBb0I7QUFDbmQsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUZqQixJQUFNLG1DQUFtQztBQUl6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsV0FBVyxLQUFLLFFBQVEsa0NBQVcsdUJBQXVCO0FBQUEsTUFDMUQsWUFBWSxLQUFLLFFBQVEsa0NBQVcsd0JBQXdCO0FBQUE7QUFBQSxNQUU1RCxpQkFBaUIsS0FBSyxRQUFRLGtDQUFXLHVCQUF1QjtBQUFBLE1BQ2hFLE9BQU8sS0FBSyxRQUFRLGtDQUFXLHVCQUF1QjtBQUFBLE1BQ3RELFFBQVEsS0FBSyxRQUFRLGtDQUFXLHVCQUF1QjtBQUFBLElBQ3pEO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLElBQ1Y7QUFBQSxJQUNBLElBQUk7QUFBQTtBQUFBLE1BRUYsT0FBTyxDQUFDLElBQUk7QUFBQSxJQUNkO0FBQUEsRUFDRjtBQUFBLEVBQ0EsTUFBTTtBQUFBLEVBQ04sT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsZUFBZTtBQUFBO0FBQUEsTUFFYixVQUFVLENBQUM7QUFBQSxJQUNiO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
