import type { ReleveMensuel } from "./diagnostic";

/**
 * Lit un nombre tapé à la française : « 12 500,5 », « 12500.5 » ou « 12 500 DH ».
 * Renvoie null pour un champ vide et NaN pour une saisie illisible.
 */
export function lireNombre(texte: string): number | null {
  const nettoye = texte
    .replace(/[\s  ]/g, "")
    .replace(/(dh|mad|kwh|kva)$/i, "")
    .replace(",", ".");
  if (nettoye === "") return null;
  return /^-?\d+(\.\d+)?$/.test(nettoye) ? Number(nettoye) : Number.NaN;
}

/** Une ligne du tableau de saisie, telle que tapée par l'utilisateur. */
export interface LigneSaisie {
  readonly mois: string;
  readonly jours: string;
  readonly releveEstime: boolean;
  readonly kwhPointe: string;
  readonly kwhPleines: string;
  readonly kwhCreuses: string;
  readonly puissanceMaxKva: string;
  readonly penaliteReactiveDh: string;
  readonly depassementDh: string;
  readonly totalTtcDh: string;
}

export type ChampSaisi = Exclude<keyof LigneSaisie, "mois" | "releveEstime">;

export const CHAMPS_SAISIS: readonly ChampSaisi[] = [
  "jours",
  "kwhPointe",
  "kwhPleines",
  "kwhCreuses",
  "puissanceMaxKva",
  "penaliteReactiveDh",
  "depassementDh",
  "totalTtcDh",
];

const OBLIGATOIRES = {
  kwhPointe: "les kWh de pointe",
  kwhPleines: "les kWh en heures pleines",
  kwhCreuses: "les kWh en heures creuses",
  puissanceMaxKva: "la puissance maximale atteinte",
} as const satisfies Partial<Record<ChampSaisi, string>>;

const LIBELLES: Record<ChampSaisi, string> = {
  ...OBLIGATOIRES,
  jours: "le nombre de jours",
  penaliteReactiveDh: "la pénalité d'énergie réactive",
  depassementDh: "les dépassements de puissance",
  totalTtcDh: "le total TTC",
};

export type ResultatLecture =
  | { readonly ok: true; readonly releves: ReleveMensuel[] }
  | { readonly ok: false; readonly erreurs: string[] };

/**
 * Transforme les lignes saisies en relevés. Les lignes entièrement vides sont ignorées ;
 * les jours valent 30 et les pénalités 0 quand ils ne sont pas renseignés.
 */
export function lireLignes(lignes: readonly LigneSaisie[]): ResultatLecture {
  const releves: ReleveMensuel[] = [];
  const erreurs: string[] = [];

  lignes.forEach((ligne, index) => {
    if (CHAMPS_SAISIS.every((champ) => ligne[champ].trim() === "")) return;

    const mois = ligne.mois.trim() || `Mois ${index + 1}`;
    const valeurs = {} as Record<ChampSaisi, number | null>;
    for (const champ of CHAMPS_SAISIS) {
      const valeur = lireNombre(ligne[champ]);
      if (valeur !== null && (Number.isNaN(valeur) || valeur < 0)) {
        erreurs.push(`${mois} : valeur invalide pour ${LIBELLES[champ]} (nombre positif attendu).`);
      }
      valeurs[champ] = valeur;
    }
    for (const [champ, libelle] of Object.entries(OBLIGATOIRES)) {
      if (valeurs[champ as keyof typeof OBLIGATOIRES] === null) {
        erreurs.push(`${mois} : il manque ${libelle}.`);
      }
    }

    const total = valeurs.totalTtcDh;
    releves.push({
      mois,
      jours: valeurs.jours ?? 30,
      releveEstime: ligne.releveEstime,
      kwhPointe: valeurs.kwhPointe ?? 0,
      kwhPleines: valeurs.kwhPleines ?? 0,
      kwhCreuses: valeurs.kwhCreuses ?? 0,
      puissanceMaxKva: valeurs.puissanceMaxKva ?? 0,
      penaliteReactiveDh: valeurs.penaliteReactiveDh ?? 0,
      depassementDh: valeurs.depassementDh ?? 0,
      ...(total === null ? {} : { totalTtcDh: total }),
    });
  });

  if (erreurs.length === 0 && releves.length === 0) {
    erreurs.push("Renseignez au moins une facture.");
  }
  return erreurs.length > 0 ? { ok: false, erreurs } : { ok: true, releves };
}
