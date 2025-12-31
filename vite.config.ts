import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: ["update.gjerdet.casa", ".gjerdet.casa", "192.168.9.24", "localhost", "127.0.0.1"],
  },
  preview: {
    host: "::",
    port: 4173,
    allowedHosts: ["update.gjerdet.casa", ".gjerdet.casa", "192.168.9.24", "localhost", "127.0.0.1"],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
