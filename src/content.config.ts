import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const guides = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/guides" }),
  schema: z.object({
    titre: z.string().max(70),
    description: z.string().min(70).max(170),
    publieLe: z.coerce.date(),
    modifieLe: z.coerce.date().optional(),
    ordre: z.number().int().positive(),
  }),
});

export const collections = { guides };
