import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    sourcemap: true,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "production" &&
      process.env.SENTRY_AUTH_TOKEN &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: { name: process.env.SENTRY_RELEASE },
        sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor: React core
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // Vendor: UI framework
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-accordion",
          ],
          // Vendor: MUI (heavy — used only by corporate MUI theme)
          "vendor-mui": [
            "@mui/material",
            "@mui/icons-material",
            "@emotion/react",
            "@emotion/styled",
          ],
          // Vendor: Charts & data
          "vendor-charts": ["recharts"],
          // Vendor: Supabase
          "vendor-supabase": ["@supabase/supabase-js"],
          // Vendor: Three.js (shader background)
          "vendor-three": ["three"],
          // Vendor: Animation
          "vendor-framer": ["framer-motion"],
          // Vendor: Utilities
          "vendor-utils": ["date-fns", "zod"],
          // ExcelJS is large; isolate so it only loads when exporting
          "vendor-exceljs": ["exceljs"],
        },
      },
    },
  },
}));
