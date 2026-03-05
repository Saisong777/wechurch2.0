import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    allowedHosts: true,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  build: {
    outDir: "dist/public",
    emptyOutDir: true,
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            // Core React - always loaded first
            if (id.includes("react-dom") || id.includes("/react/") || id.includes("react-router-dom")) {
              return "vendor-react";
            }
            // Animation library - separate chunk, only loaded where needed
            if (id.includes("framer-motion")) {
              return "vendor-motion";
            }
            // UI components
            if (id.includes("@radix-ui") || id.includes("lucide-react")) {
              return "vendor-ui";
            }
            // Data fetching
            if (id.includes("@tanstack/react-query")) {
              return "vendor-query";
            }
            // Rich text editor - large, lazy loaded
            if (id.includes("@tiptap")) {
              return "vendor-editor";
            }
            // Utility libraries
            if (
              id.includes("zod") ||
              id.includes("date-fns") ||
              id.includes("clsx") ||
              id.includes("tailwind-merge")
            ) {
              return "vendor-utils";
            }
            // Heavy one-off libraries
            if (id.includes("html2canvas")) {
              return "vendor-heavy";
            }
          }
        },
      },
    },
  },
});
