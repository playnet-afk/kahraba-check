/**
 * Tarifs et hypothèses utilisés par le diagnostic.
 *
 * Les tarifs viennent de la grille moyenne tension de l'ONEE en vigueur en juin 2026,
 * telle que publiée par kherba.com (mise à jour du 17 octobre 2026). Ils doivent être
 * confirmés sur une facture réelle avant tout engagement chiffré auprès d'un client.
 */

export interface TarifMoyenneTension {
  /** Prime fixe annuelle, en dirhams TTC par kVA souscrit. */
  readonly primeFixeDhParKvaAn: number;
  /** Prix du kWh en heures de pointe, en dirhams TTC. */
  readonly kwhPointeDh: number;
  /** Prix du kWh en heures pleines, en dirhams TTC. */
  readonly kwhPleinesDh: number;
  /** Prix du kWh en heures creuses, en dirhams TTC. */
  readonly kwhCreusesDh: number;
}

export const TARIF_MT_2026: TarifMoyenneTension = {
  primeFixeDhParKvaAn: 494.09,
  kwhPointeDh: 1.3645,
  kwhPleinesDh: 0.9736,
  kwhCreusesDh: 0.7131,
};

export const SOURCE_TARIF = {
  libelle: "Grille ONEE moyenne tension, juin 2026 (via kherba.com)",
  url: "https://kherba.com/electricite/prix-industrie",
  consulteLe: "2026-10-19",
} as const;

export interface Hypotheses {
  /** Marge ajoutée à la puissance maximale atteinte pour conseiller une puissance souscrite. */
  readonly margePuissance: number;
  /** Part de la consommation de pointe qu'un client peut raisonnablement décaler. */
  readonly partPointeDeplacable: number;
  /** Part des pénalités d'énergie réactive supprimée par une batterie de condensateurs. */
  readonly partReactiveEvitable: number;
  /** Notre rémunération : part des économies de la première année. */
  readonly commission: number;
  /** Au-delà de ce nombre de jours, une période de facturation est signalée. */
  readonly joursMaxPeriode: number;
}

export const HYPOTHESES: Hypotheses = {
  margePuissance: 0.1,
  partPointeDeplacable: 0.15,
  partReactiveEvitable: 0.9,
  commission: 0.4,
  joursMaxPeriode: 33,
};
