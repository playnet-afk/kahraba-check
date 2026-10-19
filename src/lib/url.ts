/**
 * Construit un lien interne qui tient compte du sous-dossier de publication (BASE_PATH).
 * `chemin("guides/")` donne « /kahraba-check/guides/ » sur GitHub Pages et « /guides/ » ailleurs.
 */
export function chemin(cible = ""): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
  const suite = cible.replace(/^\/+/, "");
  return `${base}/${suite}`;
}

/** Adresse absolue d'une page, pour les balises canoniques et le partage. */
export function adresseAbsolue(cible: string, site: URL | undefined): string {
  if (site === undefined) {
    throw new Error("La propriété « site » doit être définie dans astro.config.mjs.");
  }
  return new URL(chemin(cible), site).href;
}
