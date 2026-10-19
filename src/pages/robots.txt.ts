import type { APIRoute } from "astro";
import { adresseAbsolue } from "../lib/url";

export const GET: APIRoute = ({ site }) =>
  new Response(
    [
      "User-agent: *",
      "Allow: /",
      "",
      `Sitemap: ${adresseAbsolue("sitemap-index.xml", site)}`,
      "",
    ].join("\n"),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
