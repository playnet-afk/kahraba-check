import type { IdDocument } from "./demarches";
import type { Diagnostic, Site } from "./diagnostic";
import type { Dossier, Prestataire } from "./dossier";
import { formaterDh, formaterNombre, formaterPourcent, formaterTarif } from "./format";
import { conseils, decrireAnomalie } from "./rapport";
import type { BilanSuivi } from "./suivi";
import { TARIF_MT_2026 } from "./tarifs";

export type Bloc =
  | {
      readonly type: "entete";
      readonly gauche: readonly string[];
      readonly droite: readonly string[];
    }
  | { readonly type: "titre"; readonly texte: string }
  | { readonly type: "sous-titre"; readonly texte: string }
  | { readonly type: "paragraphe"; readonly texte: string }
  | { readonly type: "liste"; readonly elements: readonly string[] }
  | {
      readonly type: "tableau";
      readonly entetes: readonly string[];
      readonly lignes: readonly (readonly string[])[];
    }
  | { readonly type: "signatures"; readonly parties: readonly string[] }
  | { readonly type: "note"; readonly texte: string };

export interface DocumentDemarche {
  readonly id: IdDocument;
  readonly titre: string;
  readonly blocs: readonly Bloc[];
}

export interface Contexte {
  readonly prestataire: Prestataire;
  readonly dossier: Dossier;
  readonly site: Site;
  readonly diagnostic: Diagnostic;
  readonly bilan: BilanSuivi;
  readonly date: Date;
}

export const TITRES_DOCUMENTS: Record<IdDocument, string> = {
  rapport: "Rapport de diagnostic",
  contrat: "Contrat de mission et mandat",
  "lettre-puissance": "Lettre de modification de puissance",
  "lettre-reclamation": "Lettre de réclamation",
  "devis-condensateurs": "Demande de devis condensateurs",
  "plan-pointe": "Plan d'action heures de pointe",
  "etat-economies": "État des économies",
};

/** Valeur saisie, ou un repère visible entre crochets s'il reste à compléter. */
const ou = (valeur: string, repere: string): string => valeur.trim() || `[${repere}]`;

const dateLongue = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(date);

function identiteClient({ dossier }: Contexte): string[] {
  const { client } = dossier;
  return [
    ou(client.raisonSociale, "raison sociale du client"),
    ou(client.adresse, "adresse du client"),
    ou(client.ville, "ville"),
    client.ice.trim() === "" ? "" : `ICE : ${client.ice}`,
  ].filter((ligne) => ligne !== "");
}

function identitePrestataire({ prestataire }: Contexte): string[] {
  return [
    ou(prestataire.raisonSociale || prestataire.nom, "votre raison sociale"),
    ou(prestataire.adresse, "votre adresse"),
    ou(prestataire.ville, "votre ville"),
    [prestataire.telephone, prestataire.email].filter((v) => v.trim() !== "").join(" · "),
  ].filter((ligne) => ligne !== "");
}

function destinataireDistributeur({ dossier }: Contexte): string[] {
  return [
    ou(dossier.abonnement.distributeur, "distributeur : ONEE ou SRM"),
    "Service clientèle grands comptes",
  ];
}

function lieuEtDate(ctx: Contexte): string {
  return `${ou(ctx.dossier.client.ville, "ville")}, le ${dateLongue(ctx.date)}`;
}

function referencesContrat({ dossier }: Contexte): string {
  return `Contrat d'abonnement n° ${ou(dossier.abonnement.referenceContrat, "référence du contrat")}, site situé ${ou(dossier.abonnement.adresseSite || dossier.client.adresse, "adresse du site")}`;
}

function signataireClient({ dossier }: Contexte): string {
  return `${ou(dossier.client.representant, "nom du représentant")}, ${ou(dossier.client.fonction, "fonction")}`;
}

function rapport(ctx: Contexte): Bloc[] {
  const { diagnostic: d, site } = ctx;
  return [
    { type: "entete", gauche: identitePrestataire(ctx), droite: identiteClient(ctx) },
    { type: "titre", texte: "Rapport de diagnostic des factures d'électricité" },
    {
      type: "paragraphe",
      texte: `${referencesContrat(ctx)}. Analyse de ${site.releves.length} factures, de ${site.releves[0]?.mois ?? ""} à ${site.releves.at(-1)?.mois ?? ""}. Montants ramenés à une année.`,
    },
    {
      type: "tableau",
      entetes: ["Poste", "Perte annuelle estimée"],
      lignes: [
        ["Puissance souscrite mal réglée", formaterDh(d.economiePuissanceDh)],
        ["Pénalités d'énergie réactive évitables", formaterDh(d.economieReactiveDh)],
        ["Consommation en heures de pointe décalable", formaterDh(d.economiePointeDh)],
        ["Total", formaterDh(d.perteTotaleDh)],
      ],
    },
    {
      type: "paragraphe",
      texte: `Sur un total facturé d'environ ${formaterDh(d.totalPayeDh)} par an. Puissance souscrite : ${formaterNombre(site.puissanceSouscriteKva)} kVA ; pic atteint : ${formaterNombre(d.puissanceMaxKva)} kVA ; puissance conseillée : ${formaterNombre(d.puissanceConseilleeKva)} kVA.`,
    },
    { type: "sous-titre", texte: "Actions recommandées" },
    {
      type: "liste",
      elements: conseils(d, site.puissanceSouscriteKva).map(
        (c) => `${c.titre} : ${formaterDh(c.montantDh)} par an. ${c.texte}`,
      ),
    },
    ...(d.anomalies.length > 0
      ? ([
          { type: "sous-titre", texte: "Points à vérifier sur les factures" },
          { type: "liste", elements: d.anomalies.map(decrireAnomalie) },
        ] as const)
      : []),
    {
      type: "note",
      texte: `Estimation établie le ${dateLongue(ctx.date)} avec la grille moyenne tension de l'ONEE de juin 2026 (prime fixe ${formaterTarif(TARIF_MT_2026.primeFixeDhParKvaAn)} DH/kVA/an). Les montants définitifs dépendent des conditions de votre contrat et des factures à venir.`,
    },
  ];
}

function contrat(ctx: Contexte): Bloc[] {
  const { dossier, diagnostic: d, site, prestataire } = ctx;
  const taux = formaterPourcent(dossier.tauxCommission);
  const nomPrestataire = ou(prestataire.raisonSociale || prestataire.nom, "votre raison sociale");
  const nomClient = ou(dossier.client.raisonSociale, "raison sociale du client");
  return [
    { type: "titre", texte: "Contrat de mission d'optimisation des factures d'électricité" },
    { type: "sous-titre", texte: "Entre les soussignés" },
    {
      type: "paragraphe",
      texte: `${nomClient}, ${ou(dossier.client.adresse, "adresse")}, ${ou(dossier.client.ville, "ville")}, ICE ${ou(dossier.client.ice, "ICE")}, représentée par ${signataireClient(ctx)}, ci-après « le Client » ;`,
    },
    {
      type: "paragraphe",
      texte: `et ${nomPrestataire}, ${ou(prestataire.adresse, "adresse")}, ${ou(prestataire.ville, "ville")}, ICE ${ou(prestataire.ice, "ICE")}, RC ${ou(prestataire.rc, "RC")}, ci-après « le Prestataire ».`,
    },
    { type: "sous-titre", texte: "Article 1 : Objet" },
    {
      type: "paragraphe",
      texte: `Le Client confie au Prestataire l'optimisation des factures d'électricité de son site (${referencesContrat(ctx)}) : réglage de la puissance souscrite, réduction des pénalités d'énergie réactive, réduction de la consommation en heures de pointe et vérification des factures.`,
    },
    { type: "sous-titre", texte: "Article 2 : Mandat" },
    {
      type: "paragraphe",
      texte: `Le Client autorise le Prestataire à préparer et déposer en son nom, auprès de ${ou(dossier.abonnement.distributeur, "distributeur")}, les demandes signées par le Client, et à obtenir de ce distributeur toute information sur le contrat d'abonnement et les factures du site. Le Client reste seul titulaire de son contrat et seul décideur.`,
    },
    { type: "sous-titre", texte: "Article 3 : Situation de référence" },
    {
      type: "paragraphe",
      texte: `Les économies sont mesurées par rapport aux ${site.releves.length} factures de référence remises par le Client, de ${site.releves[0]?.mois ?? ""} à ${site.releves.at(-1)?.mois ?? ""}, dont les chiffres clés sont :`,
    },
    {
      type: "tableau",
      entetes: ["Élément de référence", "Valeur"],
      lignes: [
        ["Puissance souscrite", `${formaterNombre(site.puissanceSouscriteKva)} kVA`],
        ["Pénalités d'énergie réactive (par an)", formaterDh(d.penalitesReactivesDh)],
        [
          "Dépassements de puissance (par an)",
          formaterDh(d.anomalies.find((a) => a.type === "depassements")?.montantDh ?? 0),
        ],
        ["Total facturé (par an)", formaterDh(d.totalPayeDh)],
        ["Économie annuelle estimée par le diagnostic", formaterDh(d.perteTotaleDh)],
      ],
    },
    { type: "sous-titre", texte: "Article 4 : Calcul des économies" },
    {
      type: "liste",
      elements: [
        `Puissance : écart entre la puissance souscrite de référence et la nouvelle, multiplié par la prime fixe en vigueur (${formaterTarif(TARIF_MT_2026.primeFixeDhParKvaAn)} DH/kVA/an à la signature).`,
        "Énergie réactive et dépassements : écart entre les montants du mois de référence et ceux du même mois après intervention.",
        "Heures de pointe : baisse de la part de consommation en pointe par rapport au même mois de référence, appliquée aux kWh du mois et valorisée à l'écart de prix entre pointe et heures pleines.",
        "Les hausses de tarif décidées par les pouvoirs publics ne sont ni comptées comme des pertes ni comme des économies.",
      ],
    },
    { type: "sous-titre", texte: "Article 5 : Rémunération" },
    {
      type: "paragraphe",
      texte: `Le Prestataire perçoit ${taux} des économies constatées sur les 12 factures qui suivent la première intervention effective. Aucune somme n'est due si aucune économie n'est constatée. La rémunération est facturée chaque trimestre sur présentation d'un état des économies, payable à 30 jours. À titre indicatif, sur la base du diagnostic, elle serait d'environ ${formaterDh(d.perteTotaleDh * dossier.tauxCommission)} pour la première année.`,
    },
    { type: "sous-titre", texte: "Article 6 : Travaux électriques" },
    {
      type: "paragraphe",
      texte:
        "Le Prestataire ne réalise aucun travail électrique. Les travaux éventuels (batterie de condensateurs, réglages) sont commandés et payés directement par le Client à un électricien habilité de son choix, sous la seule responsabilité de cet électricien.",
    },
    { type: "sous-titre", texte: "Article 7 : Obligations du Client" },
    {
      type: "paragraphe",
      texte:
        "Le Client transmet au Prestataire chaque facture d'électricité dans les 10 jours suivant sa réception, pendant toute la durée du contrat, et l'informe de tout changement important de son activité.",
    },
    { type: "sous-titre", texte: "Article 8 : Confidentialité et données" },
    {
      type: "paragraphe",
      texte:
        "Les factures et informations du Client sont confidentielles et utilisées uniquement pour la mission. Elles sont traitées conformément à la loi 09-08 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel.",
    },
    { type: "sous-titre", texte: "Article 9 : Durée et litiges" },
    {
      type: "paragraphe",
      texte: `Le contrat prend effet à sa signature et s'achève après la facturation des 12 mois prévus à l'article 5. Tout litige relève du tribunal de commerce de ${ou(prestataire.ville, "ville")}.`,
    },
    { type: "paragraphe", texte: `Fait en deux exemplaires, ${lieuEtDate(ctx)}.` },
    {
      type: "signatures",
      parties: [
        `Pour le Client : ${signataireClient(ctx)}\n« Lu et approuvé, bon pour mandat »`,
        `Pour le Prestataire : ${ou(prestataire.nom, "votre nom")}\n« Lu et approuvé »`,
      ],
    },
    {
      type: "note",
      texte: "Modèle de contrat à faire relire par un avocat avant sa première utilisation.",
    },
  ];
}

function lettrePuissance(ctx: Contexte): Bloc[] {
  const { diagnostic: d, site } = ctx;
  const baisse = d.reglagePuissance === "trop-haute";
  const actuelle = formaterNombre(site.puissanceSouscriteKva);
  const conseillee = formaterNombre(d.puissanceConseilleeKva);
  return [
    { type: "entete", gauche: identiteClient(ctx), droite: destinataireDistributeur(ctx) },
    { type: "paragraphe", texte: lieuEtDate(ctx) },
    {
      type: "paragraphe",
      texte: `Objet : demande de ${baisse ? "réduction" : "augmentation"} de la puissance souscrite. ${referencesContrat(ctx)}.`,
    },
    { type: "paragraphe", texte: "Madame, Monsieur," },
    {
      type: "paragraphe",
      texte: baisse
        ? `Notre site est abonné pour une puissance de ${actuelle} kVA. Sur les ${site.releves.length} derniers mois, la puissance maximale atteinte n'a pas dépassé ${formaterNombre(d.puissanceMaxKva)} kVA, comme le montrent les relevés de vos factures repris ci-dessous.`
        : `Notre site est abonné pour une puissance de ${actuelle} kVA. Sur les ${site.releves.length} derniers mois, la puissance appelée a atteint ${formaterNombre(d.puissanceMaxKva)} kVA et des dépassements nous ont été facturés, comme le montrent les relevés de vos factures repris ci-dessous.`,
    },
    {
      type: "tableau",
      entetes: ["Mois", "Puissance maximale atteinte", "Dépassements facturés"],
      lignes: site.releves.map((r) => [
        r.mois,
        `${formaterNombre(r.puissanceMaxKva)} kVA`,
        formaterDh(r.depassementDh),
      ]),
    },
    {
      type: "paragraphe",
      texte: `Nous vous demandons donc de porter la puissance souscrite de ${actuelle} kVA à ${conseillee} kVA, à la première date possible. Nous vous remercions de nous confirmer par écrit la date d'effet de cette modification, ainsi que les frais et conditions techniques éventuels.`,
    },
    {
      type: "paragraphe",
      texte: `Le suivi de cette demande est assuré pour notre compte par ${ou(ctx.prestataire.raisonSociale || ctx.prestataire.nom, "votre raison sociale")} (${ou(ctx.prestataire.telephone, "votre téléphone")}), que nous avons mandaté à cet effet.`,
    },
    {
      type: "paragraphe",
      texte:
        "Nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.",
    },
    { type: "signatures", parties: [`${signataireClient(ctx)}\nSignature et cachet`] },
    { type: "note", texte: "Pièces jointes : copie des factures citées, copie du mandat." },
  ];
}

function lettreReclamation(ctx: Contexte): Bloc[] {
  const anomalies = ctx.diagnostic.anomalies.filter((a) => a.type !== "depassements");
  return [
    { type: "entete", gauche: identiteClient(ctx), droite: destinataireDistributeur(ctx) },
    { type: "paragraphe", texte: lieuEtDate(ctx) },
    {
      type: "paragraphe",
      texte: `Objet : demande de vérification de factures. ${referencesContrat(ctx)}.`,
    },
    { type: "paragraphe", texte: "Madame, Monsieur," },
    {
      type: "paragraphe",
      texte: "L'examen de nos factures d'électricité fait apparaître les points suivants :",
    },
    { type: "liste", elements: anomalies.map(decrireAnomalie) },
    {
      type: "paragraphe",
      texte:
        "Nous vous demandons de nous communiquer, pour chacune de ces factures, l'index réellement relevé, les dates exactes de relevé et le détail de la régularisation appliquée. Si un montant a été facturé en trop, nous vous remercions de le porter en avoir sur notre prochaine facture.",
    },
    {
      type: "paragraphe",
      texte:
        "Nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.",
    },
    { type: "signatures", parties: [`${signataireClient(ctx)}\nSignature et cachet`] },
    { type: "note", texte: "Pièces jointes : copie des factures citées, copie du mandat." },
  ];
}

function devisCondensateurs(ctx: Contexte): Bloc[] {
  const { diagnostic: d, site } = ctx;
  return [
    { type: "entete", gauche: identitePrestataire(ctx), droite: ["[Électricien destinataire]"] },
    { type: "paragraphe", texte: lieuEtDate(ctx) },
    {
      type: "paragraphe",
      texte: `Objet : demande de devis pour la compensation de l'énergie réactive du site de ${ou(ctx.dossier.client.raisonSociale, "raison sociale du client")}.`,
    },
    {
      type: "paragraphe",
      texte: `Le site, alimenté en moyenne tension (${formaterNombre(site.puissanceSouscriteKva)} kVA souscrits, pic de ${formaterNombre(d.puissanceMaxKva)} kVA), paie environ ${formaterDh(d.penalitesReactivesDh)} par an de pénalités d'énergie réactive :`,
    },
    {
      type: "tableau",
      entetes: ["Mois", "Pénalité réactive", "kWh du mois"],
      lignes: site.releves.map((r) => [
        r.mois,
        formaterDh(r.penaliteReactiveDh),
        formaterNombre(r.kwhPointe + r.kwhPleines + r.kwhCreuses),
      ]),
    },
    { type: "paragraphe", texte: "Merci de nous adresser un devis comprenant :" },
    {
      type: "liste",
      elements: [
        "une visite et une mesure sur site (cos φ, harmoniques, état de la batterie existante s'il y en a une) ;",
        "le dimensionnement et la fourniture d'une batterie de condensateurs automatique adaptée ;",
        "la pose, la mise en service et le réglage ;",
        "le délai d'intervention, la garantie et le contrat d'entretien proposé ;",
        "votre attestation d'habilitation et votre assurance responsabilité civile professionnelle.",
      ],
    },
    {
      type: "paragraphe",
      texte: `Le devis sera accepté et payé directement par le client. Contact sur site : ${signataireClient(ctx)}, ${ou(ctx.dossier.client.telephone, "téléphone du client")}.`,
    },
    {
      type: "signatures",
      parties: [`${ou(ctx.prestataire.nom, "votre nom")}, pour le compte du client`],
    },
  ];
}

function planPointe(ctx: Contexte): Bloc[] {
  const { diagnostic: d, site } = ctx;
  const ecart = TARIF_MT_2026.kwhPointeDh - TARIF_MT_2026.kwhPleinesDh;
  return [
    { type: "entete", gauche: identitePrestataire(ctx), droite: identiteClient(ctx) },
    { type: "titre", texte: "Plan d'action heures de pointe" },
    {
      type: "paragraphe",
      texte: `Chaque kWh consommé en heures de pointe coûte ${formaterTarif(ecart)} DH de plus qu'en heures pleines. Décaler une partie de la pointe rapporte environ ${formaterDh(d.economiePointeDh)} par an sur ce site.`,
    },
    {
      type: "tableau",
      entetes: ["Mois", "kWh en pointe", "Part de la consommation"],
      lignes: site.releves.map((r) => {
        const total = r.kwhPointe + r.kwhPleines + r.kwhCreuses;
        return [
          r.mois,
          formaterNombre(r.kwhPointe),
          formaterPourcent(total > 0 ? r.kwhPointe / total : 0),
        ];
      }),
    },
    { type: "sous-titre", texte: "Horaires de pointe du contrat" },
    {
      type: "liste",
      elements: ["Hiver : [à recopier du contrat]", "Été : [à recopier du contrat]"],
    },
    { type: "sous-titre", texte: "Usages à décaler hors des heures de pointe" },
    {
      type: "tableau",
      entetes: ["Usage", "Action", "Responsable", "Fait le"],
      lignes: [
        ["Production d'eau chaude", "Programmer la chauffe en heures creuses", "", ""],
        ["Production de froid", "Sur-refroidir avant la pointe, couper pendant", "", ""],
        ["Pompage, arrosage, piscine", "Programmer en dehors de la pointe", "", ""],
        ["Climatisation", "Pré-refroidir, relever la consigne de 1 à 2 °C en pointe", "", ""],
        ["Lavage, cuisson, recharges", "Avancer ou décaler les cycles", "", ""],
      ],
    },
    {
      type: "paragraphe",
      texte:
        "Point de contrôle : comparer la part de pointe de la prochaine facture à celle du même mois de l'année précédente.",
    },
    {
      type: "signatures",
      parties: [`Responsable technique du site`, `${ou(ctx.prestataire.nom, "votre nom")}`],
    },
  ];
}

function etatEconomies(ctx: Contexte): Bloc[] {
  const { bilan, dossier } = ctx;
  return [
    { type: "entete", gauche: identitePrestataire(ctx), droite: identiteClient(ctx) },
    { type: "titre", texte: "État des économies constatées" },
    {
      type: "paragraphe",
      texte: `${referencesContrat(ctx)}. Chaque facture reçue est comparée au même mois de l'année de référence, selon l'article 4 du contrat.`,
    },
    bilan.lignes.length === 0
      ? { type: "paragraphe", texte: "Aucune facture n'a encore été saisie dans le suivi." }
      : {
          type: "tableau",
          entetes: [
            "Facture",
            "Comparée à",
            "Puissance",
            "Réactive",
            "Dépassements",
            "Pointe",
            "Total",
          ],
          lignes: bilan.lignes.map((l) => [
            l.mois,
            l.moisReference,
            formaterDh(l.puissanceDh),
            formaterDh(l.reactiveDh),
            formaterDh(l.depassementDh),
            formaterDh(l.pointeDh),
            formaterDh(l.totalDh),
          ]),
        },
    {
      type: "tableau",
      entetes: ["Récapitulatif", "Montant"],
      lignes: [
        ["Économies constatées", formaterDh(bilan.totalDh)],
        [
          `Rémunération acquise (${formaterPourcent(dossier.tauxCommission)})`,
          formaterDh(bilan.commissionAcquiseDh),
        ],
        ["Déjà facturé", formaterDh(dossier.dejaFactureDh)],
        ["Reste à facturer", formaterDh(bilan.resteAFacturerDh)],
      ],
    },
    {
      type: "paragraphe",
      texte: `Établi le ${dateLongue(ctx.date)}. Une facture conforme sera émise pour le montant restant à facturer après validation de cet état.`,
    },
    {
      type: "signatures",
      parties: [
        `Validé par le Client : ${signataireClient(ctx)}`,
        ou(ctx.prestataire.nom, "votre nom"),
      ],
    },
  ];
}

const GENERATEURS: Record<IdDocument, (ctx: Contexte) => Bloc[]> = {
  rapport,
  contrat,
  "lettre-puissance": lettrePuissance,
  "lettre-reclamation": lettreReclamation,
  "devis-condensateurs": devisCondensateurs,
  "plan-pointe": planPointe,
  "etat-economies": etatEconomies,
};

/** Prépare un document de démarche, rempli avec les chiffres du dossier. */
export function genererDocument(id: IdDocument, ctx: Contexte): DocumentDemarche {
  return { id, titre: TITRES_DOCUMENTS[id], blocs: GENERATEURS[id](ctx) };
}

/** Les repères « [à compléter] » restant dans un document, pour prévenir avant impression. */
export function champsManquants(document: DocumentDemarche): string[] {
  const textes = document.blocs.flatMap((bloc): readonly string[] => {
    switch (bloc.type) {
      case "entete":
        return [...bloc.gauche, ...bloc.droite];
      case "liste":
        return bloc.elements;
      case "tableau":
        return bloc.lignes.flat();
      case "signatures":
        return bloc.parties;
      default:
        return [bloc.texte];
    }
  });
  const reperes = textes.flatMap((texte) => texte.match(/\[[^\]]+\]/g) ?? []);
  return [...new Set(reperes)];
}
