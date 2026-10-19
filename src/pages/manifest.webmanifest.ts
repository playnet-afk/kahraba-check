import type { APIRoute } from "astro";
import { SITE } from "../config";
import { chemin } from "../lib/url";

export const GET: APIRoute = () =>
  Response.json({
    name: SITE.nom,
    short_name: SITE.nom,
    description: SITE.description,
    lang: SITE.langue,
    start_url: chemin(),
    scope: chemin(),
    display: "standalone",
    background_color: "#f4f6f9",
    theme_color: "#0f1b2b",
    icons: [
      { src: chemin("favicon.svg"), sizes: "any", type: "image/svg+xml" },
      { src: chemin("apple-touch-icon.png"), sizes: "180x180", type: "image/png" },
      { src: chemin("icon-512.png"), sizes: "512x512", type: "image/png" },
    ],
  });
