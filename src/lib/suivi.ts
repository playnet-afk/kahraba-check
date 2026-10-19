import type { Site } from "./diagnostic";
import type { FactureSuivie } from "./dossier";
import { TARIF_MT_2026, type TarifMoyenneTension } from "./tarifs";

export interface EconomieMensuelle {
  readonly mois: string;
  readonly moisReference: string;
  readonly puissanceDh: number;
  readonly reactiveDh: number;
  readonly depassementDh: number;
  readonly pointeDh: number;
  readonly totalDh: number;
}

/**
 * Compare une facture reçue après les démarches au même mois de l'année de référence.
 *
 * Puissance : écart de puissance souscrite × prime fixe mensuelle.
 * Réactive et dépassements : écart des montants facturés.
 * Pointe : baisse de la part de pointe, appliquée aux kWh du mois, × écart de prix pointe / pleines.
 * Un poste peut être négatif ; il est gardé tel quel pour que le total reste honnête.
 */
export function economieMensuelle(
  reference: Site,
  facture: FactureSuivie,
  tarif: TarifMoyenneTension = TARIF_MT_2026,
): EconomieMensuelle {
  const avant = reference.releves[facture.indexReference];
  if (avant === undefined) {
    throw new Error(`Aucune facture de référence en position ${facture.indexReference + 1}.`);
  }

  const totalAvant = avant.kwhPointe + avant.kwhPleines + avant.kwhCreuses;
  const totalApres = facture.kwhPointe + facture.kwhPleines + facture.kwhCreuses;
  const partPointeAvant = totalAvant > 0 ? avant.kwhPointe / totalAvant : 0;
  const partPointeApres = totalApres > 0 ? facture.kwhPointe / totalApres : 0;

  const puissanceDh =
    ((reference.puissanceSouscriteKva - facture.puissanceSouscriteKva) *
      tarif.primeFixeDhParKvaAn) /
    12;
  const reactiveDh = avant.penaliteReactiveDh - facture.penaliteReactiveDh;
  const depassementDh = avant.depassementDh - facture.depassementDh;
  const pointeDh =
    (partPointeAvant - partPointeApres) * totalApres * (tarif.kwhPointeDh - tarif.kwhPleinesDh);

  return {
    mois: facture.mois,
    moisReference: avant.mois,
    puissanceDh,
    reactiveDh,
    depassementDh,
    pointeDh,
    totalDh: puissanceDh + reactiveDh + depassementDh + pointeDh,
  };
}

export interface BilanSuivi {
  readonly lignes: readonly EconomieMensuelle[];
  readonly totalDh: number;
  readonly commissionAcquiseDh: number;
  readonly resteAFacturerDh: number;
}

/** Cumule les économies constatées et calcule ce qui reste à facturer au client. */
export function bilanSuivi(
  reference: Site,
  factures: readonly FactureSuivie[],
  tauxCommission: number,
  dejaFactureDh: number,
  tarif: TarifMoyenneTension = TARIF_MT_2026,
): BilanSuivi {
  const lignes = factures.map((facture) => economieMensuelle(reference, facture, tarif));
  const totalDh = lignes.reduce((somme, ligne) => somme + ligne.totalDh, 0);
  const commissionAcquiseDh = Math.max(0, totalDh) * tauxCommission;
  return {
    lignes,
    totalDh,
    commissionAcquiseDh,
    resteAFacturerDh: Math.max(0, commissionAcquiseDh - dejaFactureDh),
  };
}
