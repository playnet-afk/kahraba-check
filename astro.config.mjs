// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Adresse publique du site et sous-dossier éventuel (GitHub Pages : /kahraba-check).
// Les deux se règlent par variables d'environnement au moment du build.
const site = process.env.SITE_URL ?? "https://playnet-afk.github.io";
const base = process.env.BASE_PATH ?? "/kahraba-check";

export default defineConfig({
  site,
  base,
  trailingSlash: "always",
  integrations: [sitemap({ filter: (page) => !page.includes("/404") })],
  build: { inlineStylesheets: "auto" },
});
