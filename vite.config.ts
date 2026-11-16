import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = (file: string): string => fileURLToPath(new URL(file, import.meta.url));
const version = (JSON.parse(readFileSync(here("./package.json"), "utf8")) as { version: string }).version;

// Relative paths, so the site works under any address (GitHub Pages serves it from /statusboard/).
export default defineConfig({
  base: "./",
  define: { __VERSION__: JSON.stringify(version) },
  build: { target: ["es2020", "safari15"] },
});
