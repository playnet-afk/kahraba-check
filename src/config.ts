/**
 * Informations publiques du site.
 *
 * Les coordonnées de contact restent vides tant qu'elles ne sont pas confirmées :
 * les boutons de contact ne s'affichent que lorsqu'une valeur est renseignée.
 */
export const SITE = {
  nom: "Kahraba Check",
  slogan: "Vos factures d'électricité vérifiées, payé seulement sur les économies",
  description:
    "Diagnostic gratuit des factures d'électricité moyenne tension des entreprises au Maroc : puissance souscrite, énergie réactive, heures de pointe et solaire loi 82-21.",
  langue: "fr-MA",
  locale: "fr_MA",
  pays: "MA",
  /** Numéro WhatsApp au format international sans « + » ni espaces, par exemple « 212600000000 ». */
  whatsapp: "",
  email: "",
  /** Date de mise à jour des tarifs et des textes, affichée sur le site. */
  misAJourLe: "2026-10-19",
} as const;

/** Lien WhatsApp avec un message prérempli, ou null si aucun numéro n'est configuré. */
export function lienWhatsapp(message: string): string | null {
  if (SITE.whatsapp === "") return null;
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;
}

/** Lien e-mail avec un objet prérempli, ou null si aucune adresse n'est configurée. */
export function lienEmail(objet: string): string | null {
  if (SITE.email === "") return null;
  return `mailto:${SITE.email}?subject=${encodeURIComponent(objet)}`;
}
