// Les montants s'écrivent avec une espace entre les milliers (12 500 DH), comme sur les factures
// marocaines. Le format « fr-MA » des navigateurs utilise un point, d'où le choix de « fr-FR ».
const LOCALE = "fr-FR";

const nombre = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const pourcent = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 1 });

export const formaterNombre = (valeur: number): string => nombre.format(Math.round(valeur));
export const formaterDh = (valeur: number): string => `${formaterNombre(valeur)} DH`;
export const formaterDecimal = (valeur: number): string => decimal.format(valeur);
export const formaterPourcent = (part: number): string => pourcent.format(part);

const tarif = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

/** Prix unitaire avec toutes ses décimales utiles : 1,3645 ou 494,09. */
export const formaterTarif = (valeur: number): string => tarif.format(valeur);
