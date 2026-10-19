import type { SaisieFactures } from "./saisie";

/** Vos coordonnées, reprises sur le contrat et les courriers. */
export interface Prestataire {
  readonly nom: string;
  readonly raisonSociale: string;
  readonly adresse: string;
  readonly ville: string;
  readonly telephone: string;
  readonly email: string;
  readonly ice: string;
  readonly rc: string;
}

export interface Client {
  readonly raisonSociale: string;
  readonly representant: string;
  readonly fonction: string;
  readonly adresse: string;
  readonly ville: string;
  readonly ice: string;
  readonly telephone: string;
  readonly email: string;
}

export interface Abonnement {
  readonly distributeur: string;
  readonly referenceContrat: string;
  readonly adresseSite: string;
}

/** Une facture reçue après les démarches, comparée au même mois de l'année de référence. */
export interface FactureSuivie {
  readonly id: string;
  /** Position du mois de référence dans le tableau des factures de référence. */
  readonly indexReference: number;
  readonly mois: string;
  readonly puissanceSouscriteKva: number;
  readonly kwhPointe: number;
  readonly kwhPleines: number;
  readonly kwhCreuses: number;
  readonly penaliteReactiveDh: number;
  readonly depassementDh: number;
}

export interface Dossier {
  readonly id: string;
  readonly creeLe: string;
  readonly client: Client;
  readonly abonnement: Abonnement;
  /** Les douze factures d'avant les démarches, qui servent de référence. */
  readonly factures: SaisieFactures;
  /** Part des économies de la première année facturée au client (0 à 1). */
  readonly tauxCommission: number;
  readonly etapesFaites: readonly string[];
  readonly suivi: readonly FactureSuivie[];
  /** Commission déjà facturée sur ce dossier, en dirhams. */
  readonly dejaFactureDh: number;
}

export const PRESTATAIRE_VIDE: Prestataire = {
  nom: "",
  raisonSociale: "",
  adresse: "",
  ville: "",
  telephone: "",
  email: "",
  ice: "",
  rc: "",
};

export const CLIENT_VIDE: Client = {
  raisonSociale: "",
  representant: "",
  fonction: "",
  adresse: "",
  ville: "",
  ice: "",
  telephone: "",
  email: "",
};

export function nouveauDossier(id: string, creeLe: Date, tauxCommission: number): Dossier {
  return {
    id,
    creeLe: creeLe.toISOString(),
    client: CLIENT_VIDE,
    abonnement: { distributeur: "", referenceContrat: "", adresseSite: "" },
    factures: { puissanceSouscriteKva: "", lignes: [] },
    tauxCommission,
    etapesFaites: [],
    suivi: [],
    dejaFactureDh: 0,
  };
}

/** Nom court du dossier, pour les listes. */
export function nomDossier(dossier: Dossier): string {
  const nom = dossier.client.raisonSociale.trim() || "Client sans nom";
  const ville = dossier.client.ville.trim();
  return ville === "" ? nom : `${nom} (${ville})`;
}

/**
 * Relit des dossiers enregistrés ou importés. Les champs absents reprennent leur valeur
 * par défaut, pour que d'anciennes sauvegardes restent lisibles.
 */
export function lireDossiers(brut: unknown): Dossier[] {
  if (!Array.isArray(brut)) throw new Error("Le fichier ne contient pas une liste de dossiers.");
  return brut.map((element: unknown, index) => {
    if (typeof element !== "object" || element === null || !("id" in element)) {
      throw new Error(`Le dossier n° ${index + 1} est illisible.`);
    }
    const d = element as Partial<Dossier> & { id: unknown };
    if (typeof d.id !== "string") {
      throw new Error(`Le dossier n° ${index + 1} n'a pas d'identifiant.`);
    }
    const vide = nouveauDossier(d.id, new Date(0), 0.4);
    return {
      ...vide,
      ...d,
      id: d.id,
      client: { ...CLIENT_VIDE, ...d.client },
      abonnement: { ...vide.abonnement, ...d.abonnement },
      factures: { ...vide.factures, ...d.factures },
    };
  });
}
