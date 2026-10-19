import { CHAMPS_SAISIS, type ChampSaisi, type LigneSaisie, type SaisieFactures } from "./saisie";

/** Nombre de lignes du tableau : une année de factures mensuelles. */
export const NB_FACTURES = 12;

export const COLONNES_FACTURES: readonly {
  readonly champ: ChampSaisi;
  readonly libelle: string;
  readonly aide: string;
}[] = [
  { champ: "jours", libelle: "Jours", aide: "Nombre de jours de la période" },
  { champ: "kwhPointe", libelle: "kWh pointe", aide: "Énergie active en heures de pointe" },
  { champ: "kwhPleines", libelle: "kWh pleines", aide: "Énergie active en heures pleines" },
  { champ: "kwhCreuses", libelle: "kWh creuses", aide: "Énergie active en heures creuses" },
  { champ: "puissanceMaxKva", libelle: "Pmax (kVA)", aide: "Puissance maximale atteinte" },
  { champ: "penaliteReactiveDh", libelle: "Réactive (DH)", aide: "Pénalité d'énergie réactive" },
  { champ: "depassementDh", libelle: "Dépass. (DH)", aide: "Dépassements de puissance facturés" },
  {
    champ: "totalTtcDh",
    libelle: "Total TTC (DH)",
    aide: "Montant total de la facture, facultatif",
  },
];

/** Nom du champ de formulaire : le préfixe permet d'avoir deux tableaux sur une page. */
export const nomChamp = (prefixe: string, champ: string, ligne?: number): string =>
  ligne === undefined ? `${prefixe}${champ}` : `${prefixe}${champ}-${ligne}`;

function champ(formulaire: HTMLFormElement, nom: string): HTMLInputElement {
  const element = formulaire.elements.namedItem(nom);
  if (!(element instanceof HTMLInputElement)) throw new Error(`Champ introuvable : ${nom}`);
  return element;
}

/** Lit le tableau des factures et la puissance souscrite tels qu'ils sont saisis. */
export function lireTableau(formulaire: HTMLFormElement, prefixe = ""): SaisieFactures {
  const lignes = Array.from({ length: NB_FACTURES }, (_, i): LigneSaisie => {
    const valeurs = Object.fromEntries(
      CHAMPS_SAISIS.map((nom) => [nom, champ(formulaire, nomChamp(prefixe, nom, i)).value]),
    ) as Record<ChampSaisi, string>;
    return {
      ...valeurs,
      mois: champ(formulaire, nomChamp(prefixe, "mois", i)).value,
      releveEstime: champ(formulaire, nomChamp(prefixe, "releveEstime", i)).checked,
    };
  });
  return {
    puissanceSouscriteKva: champ(formulaire, nomChamp(prefixe, "puissanceSouscriteKva")).value,
    lignes,
  };
}

/** Remplit le tableau ; les lignes absentes de la saisie sont vidées. */
export function remplirTableau(
  formulaire: HTMLFormElement,
  saisie: SaisieFactures,
  prefixe = "",
): void {
  champ(formulaire, nomChamp(prefixe, "puissanceSouscriteKva")).value =
    saisie.puissanceSouscriteKva;
  for (let i = 0; i < NB_FACTURES; i++) {
    const ligne = saisie.lignes[i];
    champ(formulaire, nomChamp(prefixe, "mois", i)).value = ligne?.mois ?? "";
    champ(formulaire, nomChamp(prefixe, "releveEstime", i)).checked = ligne?.releveEstime ?? false;
    for (const nom of CHAMPS_SAISIS) {
      champ(formulaire, nomChamp(prefixe, nom, i)).value = ligne?.[nom] ?? "";
    }
  }
}
