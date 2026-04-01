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
      // Stub Node-only modules for browser build
      "child_process": path.resolve(__vite_injected_original_dirname, "src/lib/node-stubs.js"),
      "url": path.resolve(__vite_injected_original_dirname, "src/lib/node-stubs.js")
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvaW50ZWxsaWdlbnQta2luZC12b2x0YS9tbnQvRWNsaXBzZSBLaXRjaGVuIERlc2lnbmVyIExheW91dCBFbmdpbmUvZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9pbnRlbGxpZ2VudC1raW5kLXZvbHRhL21udC9FY2xpcHNlIEtpdGNoZW4gRGVzaWduZXIgTGF5b3V0IEVuZ2luZS9mcm9udGVuZC92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvaW50ZWxsaWdlbnQta2luZC12b2x0YS9tbnQvRWNsaXBzZSUyMEtpdGNoZW4lMjBEZXNpZ25lciUyMExheW91dCUyMEVuZ2luZS9mcm9udGVuZC92aXRlLmNvbmZpZy5qc1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJ0BlbmdpbmUnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4vZWNsaXBzZS1lbmdpbmUvc3JjJyksXG4gICAgICAnQHByaWNpbmcnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4vZWNsaXBzZS1wcmljaW5nL3NyYycpLFxuICAgICAgLy8gU3R1YiBOb2RlLW9ubHkgbW9kdWxlcyBmb3IgYnJvd3NlciBidWlsZFxuICAgICAgJ2NoaWxkX3Byb2Nlc3MnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnc3JjL2xpYi9ub2RlLXN0dWJzLmpzJyksXG4gICAgICAndXJsJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy9saWIvbm9kZS1zdHVicy5qcycpLFxuICAgIH1cbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgcHJveHk6IHtcbiAgICAgICcvYXBpJzogJ2h0dHA6Ly9sb2NhbGhvc3Q6ODg4OCdcbiAgICB9LFxuICAgIGZzOiB7XG4gICAgICAvLyBBbGxvdyBzZXJ2aW5nIGZpbGVzIGZyb20gcGFyZW50IGRpcmVjdG9yaWVzIChlbmdpbmUgKyBwcmljaW5nIG1vZHVsZXMpXG4gICAgICBhbGxvdzogWycuLiddXG4gICAgfVxuICB9LFxuICBidWlsZDoge1xuICAgIG91dERpcjogJy4uL2Rpc3QnLFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIC8vIE1hcmsgTm9kZS5qcyBidWlsdC1pbnMgYXMgZXh0ZXJuYWwgc3R1YnNcbiAgICAgIGV4dGVybmFsOiBbXSxcbiAgICB9XG4gIH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFzYixTQUFTLG9CQUFvQjtBQUNuZCxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBRmpCLElBQU0sbUNBQW1DO0FBSXpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxXQUFXLEtBQUssUUFBUSxrQ0FBVyx1QkFBdUI7QUFBQSxNQUMxRCxZQUFZLEtBQUssUUFBUSxrQ0FBVyx3QkFBd0I7QUFBQTtBQUFBLE1BRTVELGlCQUFpQixLQUFLLFFBQVEsa0NBQVcsdUJBQXVCO0FBQUEsTUFDaEUsT0FBTyxLQUFLLFFBQVEsa0NBQVcsdUJBQXVCO0FBQUEsSUFDeEQ7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsSUFDVjtBQUFBLElBQ0EsSUFBSTtBQUFBO0FBQUEsTUFFRixPQUFPLENBQUMsSUFBSTtBQUFBLElBQ2Q7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixlQUFlO0FBQUE7QUFBQSxNQUViLFVBQVUsQ0FBQztBQUFBLElBQ2I7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
