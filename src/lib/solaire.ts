import { TARIF_MT_2026 } from "./tarifs";

/**
 * Régimes de la loi 82-21 sur l'autoproduction (décret 2.25.100, en vigueur le 9 juin 2026) :
 * déclaration sous 11 kW, accord de raccordement du distributeur de 11 kW à 5 MW,
 * autorisation de l'ONEE au-delà.
 */
export type RegimeAutoproduction = "declaration" | "accord-distributeur" | "autorisation-onee";

export const SEUIL_DECLARATION_KW = 11;
export const SEUIL_AUTORISATION_KW = 5000;

export function regimeAutoproduction(puissanceKw: number): RegimeAutoproduction {
  if (puissanceKw < SEUIL_DECLARATION_KW) return "declaration";
  if (puissanceKw <= SEUIL_AUTORISATION_KW) return "accord-distributeur";
  return "autorisation-onee";
}

export interface ParametresSolaire {
  readonly consommationAnnuelleKwh: number;
  /** Part de la consommation qui a lieu en journée (0 à 1). */
  readonly partJournee: number;
  /** Part de la consommation de journée que l'installation doit couvrir (0 à 1). */
  readonly tauxCouverture: number;
  readonly prixInstalleDhParWc: number;
  readonly productibleKwhParKwc?: number;
  readonly prixKwhEviteDh?: number;
  readonly prixRachatSurplusDh?: number;
  /** Part maximale de la production qui peut être revendue au réseau. */
  readonly plafondSurplus?: number;
}

export interface SimulationSolaire {
  readonly puissanceKwc: number;
  readonly productionKwh: number;
  readonly autoconsommeKwh: number;
  readonly surplusVenduKwh: number;
  readonly surplusPerduKwh: number;
  readonly economieAnnuelleDh: number;
  readonly investissementDh: number;
  /** Années pour rembourser l'investissement, ou null si l'installation ne fait rien gagner. */
  readonly retourAnnees: number | null;
  readonly regime: RegimeAutoproduction;
}

const borner = (valeur: number, min: number, max: number) => Math.min(max, Math.max(min, valeur));

export function simulerSolaire(parametres: ParametresSolaire): SimulationSolaire {
  const {
    consommationAnnuelleKwh,
    prixInstalleDhParWc,
    productibleKwhParKwc = 1650,
    prixKwhEviteDh = TARIF_MT_2026.kwhPleinesDh,
    prixRachatSurplusDh = 0.195,
    plafondSurplus = 0.2,
  } = parametres;
  const partJournee = borner(parametres.partJournee, 0, 1);
  const tauxCouverture = borner(parametres.tauxCouverture, 0, 1);

  const consommationJourneeKwh = Math.max(0, consommationAnnuelleKwh) * partJournee;
  const puissanceKwc =
    consommationJourneeKwh > 0
      ? Math.max(1, Math.round((consommationJourneeKwh * tauxCouverture) / productibleKwhParKwc))
      : 0;
  const productionKwh = puissanceKwc * productibleKwhParKwc;
  const autoconsommeKwh = Math.min(productionKwh, consommationJourneeKwh);
  const surplusKwh = productionKwh - autoconsommeKwh;
  const surplusVenduKwh = Math.min(surplusKwh, productionKwh * plafondSurplus);
  const economieAnnuelleDh =
    autoconsommeKwh * prixKwhEviteDh + surplusVenduKwh * prixRachatSurplusDh;
  const investissementDh = puissanceKwc * 1000 * prixInstalleDhParWc;

  return {
    puissanceKwc,
    productionKwh,
    autoconsommeKwh,
    surplusVenduKwh,
    surplusPerduKwh: surplusKwh - surplusVenduKwh,
    economieAnnuelleDh,
    investissementDh,
    retourAnnees: economieAnnuelleDh > 0 ? investissementDh / economieAnnuelleDh : null,
    regime: regimeAutoproduction(puissanceKwc),
  };
}
