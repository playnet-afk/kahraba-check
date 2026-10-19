import type { Bloc, DocumentDemarche } from "./documents";

/** Découpe un texte pour surligner les repères « [à compléter] ». */
function texteAvecReperes(texte: string): Node[] {
  return texte.split(/(\[[^\]]+\])/g).map((morceau) => {
    if (!/^\[[^\]]+\]$/.test(morceau)) return document.createTextNode(morceau);
    const repere = document.createElement("mark");
    repere.textContent = morceau;
    return repere;
  });
}

function element<K extends keyof HTMLElementTagNameMap>(
  balise: K,
  classe: string,
  texte?: string,
): HTMLElementTagNameMap[K] {
  const noeud = document.createElement(balise);
  if (classe !== "") noeud.className = classe;
  if (texte !== undefined) noeud.append(...texteAvecReperes(texte));
  return noeud;
}

function rendreBloc(bloc: Bloc): HTMLElement {
  switch (bloc.type) {
    case "entete": {
      const entete = element("div", "doc-entete");
      for (const lignes of [bloc.gauche, bloc.droite]) {
        const colonne = element("div", "");
        lignes.forEach((ligne) => colonne.append(element("p", "", ligne)));
        entete.append(colonne);
      }
      return entete;
    }
    case "titre":
      return element("h3", "doc-titre", bloc.texte);
    case "sous-titre":
      return element("h4", "doc-sous-titre", bloc.texte);
    case "paragraphe":
      return element("p", "", bloc.texte);
    case "note":
      return element("p", "doc-note", bloc.texte);
    case "liste": {
      const liste = element("ul", "");
      bloc.elements.forEach((texte) => liste.append(element("li", "", texte)));
      return liste;
    }
    case "tableau": {
      const conteneur = element("div", "doc-tableau");
      const tableau = element("table", "");
      const entete = element("tr", "");
      bloc.entetes.forEach((titre) => entete.append(element("th", "", titre)));
      tableau.append(element("thead", ""), element("tbody", ""));
      tableau.tHead?.append(entete);
      for (const ligne of bloc.lignes) {
        const rangee = element("tr", "");
        ligne.forEach((cellule) => rangee.append(element("td", "", cellule)));
        tableau.tBodies[0]?.append(rangee);
      }
      conteneur.append(tableau);
      return conteneur;
    }
    case "signatures": {
      const signatures = element("div", "doc-signatures");
      bloc.parties.forEach((partie) => signatures.append(element("p", "", partie)));
      return signatures;
    }
  }
}

/** Construit l'aperçu imprimable d'un document, sans jamais interpréter de HTML saisi. */
export function rendreDocument(documentDemarche: DocumentDemarche): DocumentFragment {
  const fragment = document.createDocumentFragment();
  documentDemarche.blocs.forEach((bloc) => fragment.append(rendreBloc(bloc)));
  return fragment;
}
