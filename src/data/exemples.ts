import type { ReleveMensuel, Site } from "../lib/diagnostic";

/** Établissements fictifs qui servent à présenter l'outil. Aucun ne correspond à un client réel. */
export interface Exemple extends Site {
  readonly id: string;
  readonly secteur: string;
  readonly nom: string;
  readonly ville: string;
  readonly distributeur: string;
}

const MOIS = [
  "Oct. 2025",
  "Nov. 2025",
  "Déc. 2025",
  "Janv. 2026",
  "Févr. 2026",
  "Mars 2026",
  "Avr. 2026",
  "Mai 2026",
  "Juin 2026",
  "Juil. 2026",
  "Août 2026",
  "Sept. 2026",
] as const;

interface Profil {
  readonly base: { pointe: number; pleines: number; creuses: number; penalite: number };
  readonly saison: readonly number[];
  readonly puissanceMax: readonly number[];
  readonly jours?: Readonly<Record<number, number>>;
  readonly estimes?: readonly number[];
  readonly depassements?: Readonly<Record<number, number>>;
}

function construireReleves(profil: Profil): ReleveMensuel[] {
  return MOIS.map((mois, i) => {
    const s = profil.saison[i] ?? 1;
    return {
      mois,
      jours: profil.jours?.[i] ?? 30,
      releveEstime: profil.estimes?.includes(i) ?? false,
      kwhPointe: Math.round(profil.base.pointe * s),
      kwhPleines: Math.round(profil.base.pleines * s),
      kwhCreuses: Math.round(profil.base.creuses * (0.6 + 0.4 * s)),
      puissanceMaxKva: profil.puissanceMax[i] ?? 0,
      penaliteReactiveDh: Math.round(profil.base.penalite * s),
      depassementDh: profil.depassements?.[i] ?? 0,
    };
  });
}

export const EXEMPLES: readonly Exemple[] = [
  {
    id: "hotel",
    secteur: "Hôtellerie",
    nom: "Hôtel 4 étoiles, 120 chambres",
    ville: "Marrakech",
    distributeur: "SRM Marrakech-Safi",
    puissanceSouscriteKva: 250,
    releves: construireReleves({
      base: { pointe: 9000, pleines: 26000, creuses: 14000, penalite: 1900 },
      saison: [1, 0.92, 0.9, 0.88, 0.9, 0.95, 1, 1.1, 1.3, 1.42, 1.45, 1.25],
      puissanceMax: [128, 122, 118, 115, 117, 121, 126, 134, 148, 152, 150, 140],
      jours: { 4: 34 },
      estimes: [2, 7],
    }),
  },
  {
    id: "clinique",
    secteur: "Santé",
    nom: "Clinique privée, 60 lits",
    ville: "Casablanca",
    distributeur: "SRM Casablanca-Settat",
    puissanceSouscriteKva: 390,
    releves: construireReleves({
      base: { pointe: 15000, pleines: 41000, creuses: 22000, penalite: 3900 },
      saison: [1, 0.97, 0.98, 0.99, 0.97, 0.98, 1, 1.04, 1.12, 1.18, 1.2, 1.1],
      puissanceMax: [312, 305, 300, 298, 301, 306, 314, 322, 341, 352, 356, 333],
      estimes: [5],
    }),
  },
  {
    id: "froid",
    secteur: "Agroalimentaire",
    nom: "Chambre froide et conditionnement",
    ville: "Agadir",
    distributeur: "SRM Souss-Massa",
    puissanceSouscriteKva: 160,
    releves: construireReleves({
      base: { pointe: 7000, pleines: 23000, creuses: 16000, penalite: 900 },
      saison: [1.1, 1.15, 1.2, 1.25, 1.2, 1.1, 1, 0.95, 1, 1.05, 1.08, 1.05],
      puissanceMax: [158, 166, 172, 178, 171, 160, 149, 141, 147, 152, 155, 151],
      jours: { 9: 35 },
      depassements: { 1: 3100, 2: 5400, 3: 7600, 4: 5000 },
    }),
  },
];
