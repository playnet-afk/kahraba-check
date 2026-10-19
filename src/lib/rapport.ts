import type { Anomalie, Diagnostic } from "./diagnostic";
import { formaterDh, formaterNombre, formaterPourcent } from "./format";
import { HYPOTHESES, type Hypotheses } from "./tarifs";

export interface Conseil {
  readonly titre: string;
  readonly texte: string;
  readonly montantDh: number;
}

/** Les actions à mener, de la plus rentable à la moins rentable. Les actions sans gain sont omises. */
export function conseils(
  diagnostic: Diagnostic,
  puissanceSouscriteKva: number,
  hypotheses: Hypotheses = HYPOTHESES,
): Conseil[] {
  const liste: Conseil[] = [];
  const conseillee = formaterNombre(diagnostic.puissanceConseilleeKva);

  if (diagnostic.reglagePuissance === "trop-haute") {
    liste.push({
      titre: `Baisser la puissance souscrite à ${conseillee} kVA`,
      texte: `Vous payez ${formaterNombre(puissanceSouscriteKva)} kVA alors que votre pic n'a pas dépassé ${formaterNombre(diagnostic.puissanceMaxKva)} kVA. La demande se fait auprès de votre distributeur ; la marge de ${formaterPourcent(hypotheses.margePuissance)} protège contre les dépassements.`,
      montantDh: diagnostic.economiePuissanceDh,
    });
  } else if (diagnostic.reglagePuissance === "trop-basse" && diagnostic.economiePuissanceDh > 0) {
    liste.push({
      titre: `Augmenter la puissance souscrite à ${conseillee} kVA`,
      texte:
        "Les dépassements facturés coûtent plus cher que la prime fixe d'une puissance adaptée à votre pic réel.",
      montantDh: diagnostic.economiePuissanceDh,
    });
  }

  if (diagnostic.economieReactiveDh > 0) {
    liste.push({
      titre: "Installer ou réparer une batterie de condensateurs",
      texte: `Vos pénalités d'énergie réactive atteignent ${formaterDh(diagnostic.penalitesReactivesDh)} par an. Une batterie bien dimensionnée, posée par un électricien habilité, en supprime l'essentiel.`,
      montantDh: diagnostic.economieReactiveDh,
    });
  }

  if (diagnostic.economiePointeDh > 0) {
    liste.push({
      titre: "Décaler une partie de la consommation hors des heures de pointe",
      texte: `Programmer l'eau chaude, la production de froid, le pompage ou la recharge en dehors des heures de pointe. Hypothèse retenue : ${formaterPourcent(hypotheses.partPointeDeplacable)} de la consommation de pointe.`,
      montantDh: diagnostic.economiePointeDh,
    });
  }

  return liste.sort((a, b) => b.montantDh - a.montantDh);
}

/** Phrase lisible pour chaque anomalie relevée sur les factures. */
export function decrireAnomalie(anomalie: Anomalie): string {
  switch (anomalie.type) {
    case "releve-estime":
      return `${anomalie.mois} : relevé estimé. Vérifiez qu'un relevé réel a bien régularisé la consommation.`;
    case "periode-longue":
      return `${anomalie.mois} : période de ${anomalie.jours} jours. Une période plus longue gonfle la facture du mois : vérifiez les dates de relevé.`;
    case "depassements":
      return `Dépassements de puissance facturés : ${formaterDh(anomalie.montantDh)} par an.`;
  }
}
