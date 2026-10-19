import type { Diagnostic } from "./diagnostic";
import { formaterNombre } from "./format";

export type IdDocument =
  | "rapport"
  | "contrat"
  | "lettre-puissance"
  | "lettre-reclamation"
  | "devis-condensateurs"
  | "plan-pointe"
  | "etat-economies";

export type IdEtape =
  "contrat" | "puissance" | "reclamation" | "condensateurs" | "pointe" | "suivi" | "facturation";

export interface Etape {
  readonly id: IdEtape;
  readonly titre: string;
  /** Qui agit : vous, le client, le distributeur ou l'électricien. */
  readonly qui: string;
  readonly actions: readonly string[];
  /** Gain annuel attendu, ou null pour les étapes sans gain direct. */
  readonly gainDh: number | null;
  readonly documents: readonly IdDocument[];
}

/**
 * Les démarches à mener pour un dossier, dans l'ordre où il faut les faire.
 * Une démarche n'apparaît que si l'analyse montre qu'elle rapporte quelque chose.
 */
export function etapes(diagnostic: Diagnostic, puissanceSouscriteKva: number): Etape[] {
  const liste: Etape[] = [
    {
      id: "contrat",
      titre: "Présenter le rapport et faire signer le contrat",
      qui: "Vous et le client",
      actions: [
        "Présenter le rapport de diagnostic au dirigeant.",
        "Faire signer le contrat de mission en deux exemplaires, avec le mandat.",
        "Récupérer une copie du contrat d'abonnement d'électricité et les 12 factures originales.",
      ],
      gainDh: null,
      documents: ["rapport", "contrat"],
    },
  ];

  const conseillee = formaterNombre(diagnostic.puissanceConseilleeKva);
  const actuelle = formaterNombre(puissanceSouscriteKva);
  if (diagnostic.economiePuissanceDh > 0) {
    const sens = diagnostic.reglagePuissance === "trop-haute" ? "Baisser" : "Augmenter";
    liste.push({
      id: "puissance",
      titre: `${sens} la puissance souscrite de ${actuelle} à ${conseillee} kVA`,
      qui: "Le client signe, vous déposez",
      actions: [
        "Vérifier dans le contrat d'abonnement le délai minimal et les frais d'une modification.",
        "Faire signer la lettre par le représentant du client.",
        "Déposer la lettre à l'agence du distributeur contre accusé de réception, ou l'envoyer en recommandé.",
        "Relancer après 15 jours sans réponse et noter la date d'effet annoncée.",
      ],
      gainDh: diagnostic.economiePuissanceDh,
      documents: ["lettre-puissance"],
    });
  }

  const anomaliesFactures = diagnostic.anomalies.filter((a) => a.type !== "depassements");
  if (anomaliesFactures.length > 0) {
    liste.push({
      id: "reclamation",
      titre: "Demander l'explication des relevés estimés et des périodes longues",
      qui: "Le client signe, vous déposez",
      actions: [
        "Joindre une copie des factures concernées.",
        "Demander le relevé réel et le détail de la régularisation.",
        "Vérifier la réponse : un trop-perçu doit apparaître en avoir sur une prochaine facture.",
      ],
      gainDh: null,
      documents: ["lettre-reclamation"],
    });
  }

  if (diagnostic.economieReactiveDh > 0) {
    liste.push({
      id: "condensateurs",
      titre: "Faire poser ou réparer la batterie de condensateurs",
      qui: "Un électricien habilité, payé par le client",
      actions: [
        "Envoyer la demande de devis à deux ou trois électriciens habilités.",
        "Comparer les devis : mesure sur site, batterie automatique, garantie, délai.",
        "Le client commande et paie directement l'électricien. Vous ne réalisez aucun travail électrique.",
        "Après la pose, vérifier que la pénalité baisse dès la facture suivante.",
      ],
      gainDh: diagnostic.economieReactiveDh,
      documents: ["devis-condensateurs"],
    });
  }

  if (diagnostic.economiePointeDh > 0) {
    liste.push({
      id: "pointe",
      titre: "Remettre le plan d'action heures de pointe",
      qui: "Vous, avec le responsable technique",
      actions: [
        "Recopier les horaires de pointe d'hiver et d'été depuis le contrat d'abonnement.",
        "Parcourir le site avec le responsable technique et choisir les usages à décaler.",
        "Remettre le plan signé et fixer un point au bout d'un mois.",
      ],
      gainDh: diagnostic.economiePointeDh,
      documents: ["plan-pointe"],
    });
  }

  liste.push(
    {
      id: "suivi",
      titre: "Constater les économies sur chaque nouvelle facture",
      qui: "Vous",
      actions: [
        "Demander chaque facture au client dès sa réception.",
        "La saisir dans le suivi ci-dessous, en face du même mois de l'année de référence.",
        "Signaler tout écart anormal au client.",
      ],
      gainDh: null,
      documents: [],
    },
    {
      id: "facturation",
      titre: "Facturer la commission chaque trimestre",
      qui: "Vous",
      actions: [
        "Éditer l'état des économies et le faire valider par le client.",
        "Émettre votre facture officielle (ICE, RC, TVA si applicable) du montant restant à facturer.",
        "Arrêter la facturation au bout de 12 mois, comme prévu au contrat.",
      ],
      gainDh: null,
      documents: ["etat-economies"],
    },
  );

  return liste;
}
