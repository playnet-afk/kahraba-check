/** Renvoie l'élément de la page qui correspond au sélecteur, ou lève une erreur s'il manque. */
export function trouver<T extends Element>(selecteur: string, type: new () => T): T {
  const element = document.querySelector(selecteur);
  if (!(element instanceof type)) {
    throw new Error(`Élément introuvable ou de mauvais type : ${selecteur}`);
  }
  return element;
}
