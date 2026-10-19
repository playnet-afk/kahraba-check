/**
 * Accès au stockage local du navigateur. Il peut être bloqué (navigation privée, réglages) :
 * chaque fonction échoue alors sans bruit et l'outil continue de fonctionner.
 */

export const CLES = {
  brouillonDiagnostic: "kahraba-check:diagnostic",
  dossiers: "kahraba-check:dossiers",
  prestataire: "kahraba-check:prestataire",
} as const;

export function lireJson(cle: string): unknown {
  try {
    const brut = localStorage.getItem(cle);
    return brut === null ? null : (JSON.parse(brut) as unknown);
  } catch {
    return null;
  }
}

/** Enregistre une valeur ; renvoie false si le stockage est indisponible ou plein. */
export function ecrireJson(cle: string, valeur: unknown): boolean {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch {
    return false;
  }
}

export function supprimer(cle: string): void {
  try {
    localStorage.removeItem(cle);
  } catch {
    /* stockage indisponible */
  }
}
