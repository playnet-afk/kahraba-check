import { HYPOTHESES, TARIF_MT_2026, type Hypotheses, type TarifMoyenneTension } from "./tarifs";

/** Les chiffres d'une facture mensuelle, tels qu'ils figurent sur la facture. */
export interface ReleveMensuel {
  readonly mois: string;
  readonly jours: number;
  readonly releveEstime: boolean;
  readonly kwhPointe: number;
  readonly kwhPleines: number;
  readonly kwhCreuses: number;
  readonly puissanceMaxKva: number;
  readonly penaliteReactiveDh: number;
  readonly depassementDh: number;
  /** Montant TTC de la facture. S'il manque, il est estimé à partir des tarifs. */
  readonly totalTtcDh?: number;
}

export interface Site {
  readonly puissanceSouscriteKva: number;
  readonly releves: readonly ReleveMensuel[];
}

export type ReglagePuissance = "trop-haute" | "trop-basse" | "correcte";

export type Anomalie =
  | { readonly type: "releve-estime"; readonly mois: string }
  | { readonly type: "periode-longue"; readonly mois: string; readonly jours: number }
  | { readonly type: "depassements"; readonly montantDh: number };

export interface Diagnostic {
  readonly puissanceMaxKva: number;
  readonly puissanceConseilleeKva: number;
  readonly reglagePuissance: ReglagePuissance;
  readonly economiePuissanceDh: number;
  readonly penalitesReactivesDh: number;
  readonly economieReactiveDh: number;
  readonly economiePointeDh: number;
  readonly perteTotaleDh: number;
  readonly commissionDh: number;
  readonly totalPayeDh: number;
  readonly consommationKwh: number;
  readonly anomalies: readonly Anomalie[];
}

export class DonneesInvalides extends Error {
  constructor(readonly erreurs: readonly string[]) {
    super(erreurs.join(" "));
    this.name = "DonneesInvalides";
  }
}

const CHAMPS_NUMERIQUES = [
  "jours",
  "kwhPointe",
  "kwhPleines",
  "kwhCreuses",
  "puissanceMaxKva",
  "penaliteReactiveDh",
  "depassementDh",
] as const satisfies readonly (keyof ReleveMensuel)[];

/** Liste les problèmes qui empêchent un diagnostic fiable. Une liste vide veut dire que tout va bien. */
export function validerSite(site: Site): string[] {
  const erreurs: string[] = [];
  if (!(site.puissanceSouscriteKva > 0)) {
    erreurs.push("La puissance souscrite doit être un nombre positif.");
  }
  if (site.releves.length === 0) {
    erreurs.push("Il faut au moins une facture.");
  }
  site.releves.forEach((releve) => {
    for (const champ of CHAMPS_NUMERIQUES) {
      const valeur = releve[champ];
      if (!Number.isFinite(valeur) || valeur < 0) {
        erreurs.push(`${releve.mois} : la valeur « ${champ} » doit être un nombre positif ou nul.`);
      }
    }
    if (
      releve.totalTtcDh !== undefined &&
      (!Number.isFinite(releve.totalTtcDh) || releve.totalTtcDh < 0)
    ) {
      erreurs.push(`${releve.mois} : le total TTC doit être un nombre positif ou nul.`);
    }
  });
  return erreurs;
}

/** Montant TTC estimé d'une facture à partir des tarifs, quand il n'a pas été saisi. */
export function estimerTotalTtc(
  releve: ReleveMensuel,
  puissanceSouscriteKva: number,
  tarif: TarifMoyenneTension = TARIF_MT_2026,
): number {
  return (
    releve.kwhPointe * tarif.kwhPointeDh +
    releve.kwhPleines * tarif.kwhPleinesDh +
    releve.kwhCreuses * tarif.kwhCreusesDh +
    releve.penaliteReactiveDh +
    releve.depassementDh +
    (puissanceSouscriteKva * tarif.primeFixeDhParKvaAn) / 12
  );
}

/**
 * Calcule l'argent perdu chaque année sur les factures d'un site.
 *
 * Les montants sont annualisés : avec moins de 12 factures, ils sont ramenés à une année.
 * La puissance n'est jamais conseillée en dessous du pic réellement atteint, majoré de la marge.
 */
export function diagnostiquer(
  site: Site,
  tarif: TarifMoyenneTension = TARIF_MT_2026,
  hypotheses: Hypotheses = HYPOTHESES,
): Diagnostic {
  const erreurs = validerSite(site);
  if (erreurs.length > 0) {
    throw new DonneesInvalides(erreurs);
  }

  const { releves, puissanceSouscriteKva: souscrite } = site;
  const annualisation = 12 / releves.length;
  const somme = (lire: (r: ReleveMensuel) => number) =>
    releves.reduce((total, releve) => total + lire(releve), 0);

  const puissanceMaxKva = Math.max(...releves.map((r) => r.puissanceMaxKva));
  // L'arrondi à 6 décimales évite que 180 × 1,1 = 198,00000000000003 devienne 199 kVA.
  const puissanceConseilleeKva = Math.ceil(
    Number((puissanceMaxKva * (1 + hypotheses.margePuissance)).toFixed(6)),
  );
  const depassementsDh = somme((r) => r.depassementDh) * annualisation;

  let reglagePuissance: ReglagePuissance = "correcte";
  let economiePuissanceDh = 0;
  if (souscrite > puissanceConseilleeKva) {
    reglagePuissance = "trop-haute";
    economiePuissanceDh = (souscrite - puissanceConseilleeKva) * tarif.primeFixeDhParKvaAn;
  } else if (depassementsDh > 0) {
    reglagePuissance = "trop-basse";
    const surcoutPrimeFixe =
      Math.max(0, puissanceConseilleeKva - souscrite) * tarif.primeFixeDhParKvaAn;
    economiePuissanceDh = Math.max(0, depassementsDh - surcoutPrimeFixe);
  }

  const penalitesReactivesDh = somme((r) => r.penaliteReactiveDh) * annualisation;
  const economieReactiveDh = penalitesReactivesDh * hypotheses.partReactiveEvitable;
  const economiePointeDh =
    somme((r) => r.kwhPointe) *
    annualisation *
    hypotheses.partPointeDeplacable *
    (tarif.kwhPointeDh - tarif.kwhPleinesDh);

  const perteTotaleDh = economiePuissanceDh + economieReactiveDh + economiePointeDh;
  const totalPayeDh =
    somme((r) => r.totalTtcDh ?? estimerTotalTtc(r, souscrite, tarif)) * annualisation;

  const anomalies: Anomalie[] = [];
  for (const releve of releves) {
    if (releve.releveEstime) {
      anomalies.push({ type: "releve-estime", mois: releve.mois });
    }
  }
  for (const releve of releves) {
    if (releve.jours > hypotheses.joursMaxPeriode) {
      anomalies.push({ type: "periode-longue", mois: releve.mois, jours: releve.jours });
    }
  }
  if (depassementsDh > 0) {
    anomalies.push({ type: "depassements", montantDh: depassementsDh });
  }

  return {
    puissanceMaxKva,
    puissanceConseilleeKva,
    reglagePuissance,
    economiePuissanceDh,
    penalitesReactivesDh,
    economieReactiveDh,
    economiePointeDh,
    perteTotaleDh,
    commissionDh: perteTotaleDh * hypotheses.commission,
    totalPayeDh,
    consommationKwh: somme((r) => r.kwhPointe + r.kwhPleines + r.kwhCreuses) * annualisation,
    anomalies,
  };
}
