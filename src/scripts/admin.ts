import { EXEMPLES } from "../data/exemples";
import { etapes, type IdDocument } from "../lib/demarches";
import { diagnostiquer, type Diagnostic, type Site } from "../lib/diagnostic";
import { trouver } from "../lib/dom";
import { champsManquants, genererDocument, TITRES_DOCUMENTS } from "../lib/documents";
import {
  lireDossiers,
  nomDossier,
  nouveauDossier,
  PRESTATAIRE_VIDE,
  type Dossier,
  type FactureSuivie,
  type Prestataire,
} from "../lib/dossier";
import { formaterDh, formaterNombre, formaterPourcent } from "../lib/format";
import { rendreDocument } from "../lib/rendu-document";
import { lireNombre, lireSaisie, saisieDepuisSite, type SaisieFactures } from "../lib/saisie";
import { CLES, ecrireJson, lireJson } from "../lib/stockage";
import { bilanSuivi } from "../lib/suivi";
import { lireTableau, remplirTableau } from "../lib/tableau-factures";
import { HYPOTHESES } from "../lib/tarifs";

const PREFIXE = "ref-";

const choixDossier = trouver("#choix-dossier", HTMLSelectElement);
const boutonNouveau = trouver("#nouveau", HTMLButtonElement);
const boutonSupprimer = trouver("#supprimer", HTMLButtonElement);
const boutonExporter = trouver("#exporter", HTMLButtonElement);
const champImport = trouver("#importer", HTMLInputElement);
const messageSauvegarde = trouver("#message-sauvegarde", HTMLParagraphElement);
const formPrestataire = trouver("#form-prestataire", HTMLFormElement);
const sansDossier = trouver("#sans-dossier", HTMLParagraphElement);
const espaceDossier = trouver("#espace-dossier", HTMLDivElement);
const formDossier = trouver("#form-dossier", HTMLFormElement);
const boutonReprendre = trouver("#reprendre-diagnostic", HTMLButtonElement);
const choixExemple = trouver("#exemple-dossier", HTMLSelectElement);
const erreursDossier = trouver("#erreurs-dossier", HTMLDivElement);
const blocAnalyse = trouver("#bloc-analyse", HTMLElement);
const resume = trouver("#resume", HTMLDListElement);
const blocEtapes = trouver("#bloc-etapes", HTMLElement);
const listeEtapes = trouver("#etapes", HTMLOListElement);
const avancement = trouver("#avancement", HTMLParagraphElement);
const blocSuivi = trouver("#bloc-suivi", HTMLElement);
const formSuivi = trouver("#form-suivi", HTMLFormElement);
const erreursSuivi = trouver("#erreurs-suivi", HTMLParagraphElement);
const tableSuivi = trouver("#table-suivi", HTMLTableElement);
const bilanListe = trouver("#bilan", HTMLDListElement);
const champDejaFacture = trouver("#deja-facture", HTMLInputElement);
const blocDocument = trouver("#bloc-document", HTMLElement);
const titreDocument = trouver("#titre-document", HTMLHeadingElement);
const manquants = trouver("#manquants", HTMLParagraphElement);
const apercu = trouver("#apercu", HTMLElement);
const boutonImprimer = trouver("#imprimer-document", HTMLButtonElement);
const boutonFermer = trouver("#fermer-document", HTMLButtonElement);

interface Analyse {
  readonly site: Site;
  readonly diagnostic: Diagnostic;
}

let dossiers: Dossier[] = [];
let prestataire: Prestataire = PRESTATAIRE_VIDE;
let idCourant: string | null = null;
let documentOuvert: IdDocument | null = null;

// ---------- Enregistrement ----------

function chargerDonnees(): void {
  try {
    dossiers = lireDossiers(lireJson(CLES.dossiers) ?? []);
  } catch {
    dossiers = [];
    messageSauvegarde.textContent =
      "Les dossiers enregistrés sont illisibles. Importez votre dernière sauvegarde.";
  }
  const brut = lireJson(CLES.prestataire);
  prestataire = { ...PRESTATAIRE_VIDE, ...(typeof brut === "object" && brut !== null ? brut : {}) };
  idCourant = dossiers[0]?.id ?? null;
}

function enregistrer(): void {
  const ok = ecrireJson(CLES.dossiers, dossiers) && ecrireJson(CLES.prestataire, prestataire);
  messageSauvegarde.textContent = ok
    ? `Enregistré dans ce navigateur à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.`
    : "Impossible d'enregistrer dans ce navigateur (navigation privée ?). Exportez vos dossiers pour ne rien perdre.";
}

const dossierCourant = (): Dossier | undefined => dossiers.find((d) => d.id === idCourant);

function modifierDossier(modification: (dossier: Dossier) => Dossier): void {
  dossiers = dossiers.map((d) => (d.id === idCourant ? modification(d) : d));
  enregistrer();
}

// ---------- Formulaires ----------

function lireChemin(dossier: Dossier, chemin: string): string {
  if (chemin === "tauxCommission") return formaterNombre(dossier.tauxCommission * 100);
  const [groupe, champ] = chemin.split(".") as ["client" | "abonnement", string];
  return (dossier[groupe] as unknown as Record<string, string>)[champ] ?? "";
}

function appliquerChemin(dossier: Dossier, chemin: string, valeur: string): Dossier {
  if (chemin === "tauxCommission") {
    const pourcent = lireNombre(valeur);
    if (pourcent === null || Number.isNaN(pourcent) || pourcent < 0 || pourcent > 100) {
      return dossier;
    }
    return { ...dossier, tauxCommission: pourcent / 100 };
  }
  const [groupe, champ] = chemin.split(".") as ["client" | "abonnement", string];
  return { ...dossier, [groupe]: { ...dossier[groupe], [champ]: valeur } };
}

function champsDossier(): HTMLInputElement[] {
  return [...formDossier.querySelectorAll<HTMLInputElement>("input[data-chemin]")];
}

function remplirFormulaireDossier(dossier: Dossier): void {
  for (const champ of champsDossier()) {
    champ.value = lireChemin(dossier, champ.dataset["chemin"] ?? "");
  }
  remplirTableau(formDossier, dossier.factures, PREFIXE);
  champDejaFacture.value = dossier.dejaFactureDh === 0 ? "" : String(dossier.dejaFactureDh);
}

function remplirPrestataire(): void {
  formPrestataire.querySelectorAll<HTMLInputElement>("input[data-champ]").forEach((champ) => {
    const cle = champ.dataset["champ"] as keyof Prestataire;
    champ.value = prestataire[cle];
  });
}

// ---------- Affichage ----------

function afficherListe(): void {
  choixDossier.replaceChildren(
    ...dossiers.map((d) => new Option(nomDossier(d), d.id, false, d.id === idCourant)),
  );
  choixDossier.disabled = dossiers.length === 0;
  boutonSupprimer.disabled = dossiers.length === 0;
  sansDossier.hidden = dossiers.length > 0;
  espaceDossier.hidden = dossiers.length === 0;
}

function ligneResume(cible: HTMLDListElement, lignes: readonly [string, string][]): void {
  cible.replaceChildren(
    ...lignes.map(([terme, valeur]) => {
      const groupe = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = terme;
      dd.textContent = valeur;
      groupe.append(dt, dd);
      return groupe;
    }),
  );
}

function analyser(dossier: Dossier): Analyse | null {
  const auMoinsUneFacture = dossier.factures.lignes.some((l) => l.kwhPointe.trim() !== "");
  const lecture = lireSaisie(dossier.factures);
  erreursDossier.replaceChildren();
  if (!lecture.ok) {
    erreursDossier.hidden = !auMoinsUneFacture;
    const titre = document.createElement("p");
    titre.textContent = "Complétez les factures pour obtenir les démarches :";
    const liste = document.createElement("ul");
    lecture.erreurs.forEach((erreur) => {
      const li = document.createElement("li");
      li.textContent = erreur;
      liste.append(li);
    });
    erreursDossier.append(titre, liste);
    return null;
  }
  erreursDossier.hidden = true;
  return { site: lecture.site, diagnostic: diagnostiquer(lecture.site) };
}

function afficherEtapes(dossier: Dossier, analyse: Analyse): void {
  const liste = etapes(analyse.diagnostic, analyse.site.puissanceSouscriteKva);
  const faites = liste.filter((e) => dossier.etapesFaites.includes(e.id)).length;
  avancement.textContent = `${faites} sur ${liste.length} faites`;

  listeEtapes.replaceChildren(
    ...liste.map((etape) => {
      const faite = dossier.etapesFaites.includes(etape.id);
      const li = document.createElement("li");
      li.classList.toggle("faite", faite);

      const entete = document.createElement("div");
      entete.className = "entete-etape";
      const label = document.createElement("label");
      const caseFaite = document.createElement("input");
      caseFaite.type = "checkbox";
      caseFaite.checked = faite;
      caseFaite.dataset["etape"] = etape.id;
      label.append(caseFaite, etape.titre);
      entete.append(label);
      if (etape.gainDh !== null) {
        const gain = document.createElement("span");
        gain.className = "chiffre gain";
        gain.textContent = `+ ${formaterDh(etape.gainDh)} / an`;
        entete.append(gain);
      }

      const qui = document.createElement("p");
      qui.className = "qui";
      qui.textContent = etape.qui;

      const actions = document.createElement("ul");
      etape.actions.forEach((action) => {
        const item = document.createElement("li");
        item.textContent = action;
        actions.append(item);
      });

      li.append(entete, qui, actions);
      if (etape.documents.length > 0) {
        const documents = document.createElement("div");
        documents.className = "documents";
        etape.documents.forEach((id) => {
          const bouton = document.createElement("button");
          bouton.type = "button";
          bouton.className = "bouton secondaire";
          bouton.dataset["document"] = id;
          bouton.textContent = TITRES_DOCUMENTS[id];
          documents.append(bouton);
        });
        li.append(documents);
      }
      return li;
    }),
  );
}

function afficherSuivi(dossier: Dossier, analyse: Analyse): void {
  const selection = formSuivi.elements.namedItem("indexReference");
  if (selection instanceof HTMLSelectElement) {
    const valeur = selection.value;
    selection.replaceChildren(...analyse.site.releves.map((r, i) => new Option(r.mois, String(i))));
    if (valeur !== "" && Number(valeur) < analyse.site.releves.length) selection.value = valeur;
  }

  const suiviValide = dossier.suivi.filter((f) => f.indexReference < analyse.site.releves.length);
  const bilan = bilanSuivi(
    analyse.site,
    suiviValide,
    dossier.tauxCommission,
    dossier.dejaFactureDh,
  );
  const corps = tableSuivi.tBodies[0];
  corps?.replaceChildren(
    ...bilan.lignes.map((ligne, i) => {
      const tr = document.createElement("tr");
      for (const texte of [ligne.mois, ligne.moisReference, formaterDh(ligne.totalDh)]) {
        const td = document.createElement("td");
        td.textContent = texte;
        tr.append(td);
      }
      const td = document.createElement("td");
      const retirer = document.createElement("button");
      retirer.type = "button";
      retirer.dataset["retirer"] = suiviValide[i]?.id ?? "";
      retirer.textContent = "Retirer";
      td.append(retirer);
      tr.append(td);
      return tr;
    }),
  );
  ligneResume(bilanListe, [
    ["Économies constatées", formaterDh(bilan.totalDh)],
    [
      `Commission acquise (${formaterPourcent(dossier.tauxCommission)})`,
      formaterDh(bilan.commissionAcquiseDh),
    ],
    ["Reste à facturer", formaterDh(bilan.resteAFacturerDh)],
  ]);
}

function afficherDocument(dossier: Dossier, analyse: Analyse | null): void {
  if (documentOuvert === null || analyse === null) {
    blocDocument.hidden = true;
    return;
  }
  const suiviValide = dossier.suivi.filter((f) => f.indexReference < analyse.site.releves.length);
  const doc = genererDocument(documentOuvert, {
    prestataire,
    dossier,
    site: analyse.site,
    diagnostic: analyse.diagnostic,
    bilan: bilanSuivi(analyse.site, suiviValide, dossier.tauxCommission, dossier.dejaFactureDh),
    date: new Date(),
  });
  titreDocument.textContent = doc.titre;
  apercu.replaceChildren(rendreDocument(doc));
  const reperes = champsManquants(doc);
  manquants.hidden = reperes.length === 0;
  manquants.textContent = `À compléter avant impression (surligné en jaune) : ${reperes.join(", ")}. Renseignez-les dans « Mes informations » ou dans le dossier.`;
  blocDocument.hidden = false;
}

function afficherDossier(): void {
  afficherListe();
  const dossier = dossierCourant();
  if (dossier === undefined) return;
  const analyse = analyser(dossier);
  blocAnalyse.hidden = analyse === null;
  blocEtapes.hidden = analyse === null;
  blocSuivi.hidden = analyse === null;
  if (analyse !== null) {
    const d = analyse.diagnostic;
    ligneResume(resume, [
      ["Perte annuelle estimée", formaterDh(d.perteTotaleDh)],
      ["Puissance", formaterDh(d.economiePuissanceDh)],
      ["Énergie réactive", formaterDh(d.economieReactiveDh)],
      ["Heures de pointe", formaterDh(d.economiePointeDh)],
      [
        `Votre commission (${formaterPourcent(dossier.tauxCommission)})`,
        formaterDh(d.perteTotaleDh * dossier.tauxCommission),
      ],
    ]);
    afficherEtapes(dossier, analyse);
    afficherSuivi(dossier, analyse);
  }
  afficherDocument(dossier, analyse);
}

function ouvrirDossier(id: string | null): void {
  idCourant = id;
  documentOuvert = null;
  const dossier = dossierCourant();
  if (dossier !== undefined) remplirFormulaireDossier(dossier);
  afficherDossier();
}

// ---------- Actions ----------

function creerDossier(): void {
  const dossier = nouveauDossier(crypto.randomUUID(), new Date(), HYPOTHESES.commission);
  dossiers = [dossier, ...dossiers];
  enregistrer();
  ouvrirDossier(dossier.id);
  formDossier.querySelector<HTMLInputElement>("input[data-chemin]")?.focus();
}

function remplacerFactures(saisie: SaisieFactures): void {
  remplirTableau(formDossier, saisie, PREFIXE);
  modifierDossier((d) => ({ ...d, factures: lireTableau(formDossier, PREFIXE) }));
  afficherDossier();
}

function exporter(): void {
  const contenu = JSON.stringify({ version: 1, prestataire, dossiers }, null, 2);
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(new Blob([contenu], { type: "application/json" }));
  lien.download = `kahraba-check-dossiers-${new Date().toISOString().slice(0, 10)}.json`;
  lien.click();
  URL.revokeObjectURL(lien.href);
}

async function importer(fichier: File): Promise<void> {
  try {
    const contenu = JSON.parse(await fichier.text()) as unknown;
    const sauvegarde =
      typeof contenu === "object" && contenu !== null && "dossiers" in contenu
        ? (contenu as { dossiers: unknown; prestataire?: unknown })
        : { dossiers: contenu };
    const importes = lireDossiers(sauvegarde.dossiers);
    const ids = new Set(importes.map((d) => d.id));
    dossiers = [...importes, ...dossiers.filter((d) => !ids.has(d.id))];
    if (typeof sauvegarde.prestataire === "object" && sauvegarde.prestataire !== null) {
      prestataire = { ...PRESTATAIRE_VIDE, ...sauvegarde.prestataire };
      remplirPrestataire();
    }
    enregistrer();
    messageSauvegarde.textContent = `${importes.length} dossier(s) importé(s).`;
    ouvrirDossier(importes[0]?.id ?? idCourant);
  } catch (erreur) {
    messageSauvegarde.textContent = `Import impossible : ${erreur instanceof Error ? erreur.message : "fichier illisible"}.`;
  }
}

function ajouterFactureSuivie(): void {
  const lire = (nom: string) => {
    const element = formSuivi.elements.namedItem(nom);
    return element instanceof HTMLInputElement || element instanceof HTMLSelectElement
      ? element.value
      : "";
  };
  const champs = [
    "puissanceSouscriteKva",
    "kwhPointe",
    "kwhPleines",
    "kwhCreuses",
    "penaliteReactiveDh",
    "depassementDh",
  ] as const;
  const valeurs = Object.fromEntries(champs.map((c) => [c, lireNombre(lire(c)) ?? 0]));
  const invalides = champs.filter((c) => {
    const v = valeurs[c];
    return v === undefined || Number.isNaN(v) || v < 0;
  });
  const mois = lire("mois").trim();
  if (mois === "" || invalides.length > 0 || !(Number(valeurs["puissanceSouscriteKva"]) > 0)) {
    erreursSuivi.textContent =
      "Indiquez le mois, la puissance souscrite de la nouvelle facture et des montants positifs.";
    erreursSuivi.hidden = false;
    return;
  }
  erreursSuivi.hidden = true;
  const facture: FactureSuivie = {
    id: crypto.randomUUID(),
    indexReference: Number(lire("indexReference")),
    mois,
    puissanceSouscriteKva: valeurs["puissanceSouscriteKva"] ?? 0,
    kwhPointe: valeurs["kwhPointe"] ?? 0,
    kwhPleines: valeurs["kwhPleines"] ?? 0,
    kwhCreuses: valeurs["kwhCreuses"] ?? 0,
    penaliteReactiveDh: valeurs["penaliteReactiveDh"] ?? 0,
    depassementDh: valeurs["depassementDh"] ?? 0,
  };
  modifierDossier((d) => ({ ...d, suivi: [...d.suivi, facture] }));
  formSuivi.reset();
  afficherDossier();
}

// ---------- Événements ----------

choixDossier.addEventListener("change", () => ouvrirDossier(choixDossier.value));
boutonNouveau.addEventListener("click", creerDossier);
boutonSupprimer.addEventListener("click", () => {
  const dossier = dossierCourant();
  if (dossier === undefined) return;
  if (!window.confirm(`Supprimer définitivement le dossier « ${nomDossier(dossier)} » ?`)) return;
  dossiers = dossiers.filter((d) => d.id !== dossier.id);
  enregistrer();
  ouvrirDossier(dossiers[0]?.id ?? null);
});
boutonExporter.addEventListener("click", exporter);
champImport.addEventListener("change", () => {
  const fichier = champImport.files?.[0];
  if (fichier !== undefined) void importer(fichier);
  champImport.value = "";
});

formPrestataire.addEventListener("input", (evenement) => {
  const champ = evenement.target;
  if (!(champ instanceof HTMLInputElement)) return;
  const cle = champ.dataset["champ"] as keyof Prestataire | undefined;
  if (cle === undefined) return;
  prestataire = { ...prestataire, [cle]: champ.value };
  enregistrer();
  const dossier = dossierCourant();
  if (dossier !== undefined) afficherDocument(dossier, analyser(dossier));
});

formDossier.addEventListener("input", (evenement) => {
  const champ = evenement.target;
  if (!(champ instanceof HTMLInputElement)) return;
  const chemin = champ.dataset["chemin"];
  modifierDossier((d) =>
    chemin === undefined
      ? { ...d, factures: lireTableau(formDossier, PREFIXE) }
      : appliquerChemin(d, chemin, champ.value),
  );
  afficherDossier();
});
formDossier.addEventListener("submit", (evenement) => evenement.preventDefault());

boutonReprendre.addEventListener("click", () => {
  const brouillon = lireJson(CLES.brouillonDiagnostic) as SaisieFactures | null;
  if (brouillon === null) {
    messageSauvegarde.textContent = "Aucune saisie trouvée dans le diagnostic de ce navigateur.";
    return;
  }
  remplacerFactures(brouillon);
});

choixExemple.addEventListener("change", () => {
  const exemple = EXEMPLES.find((e) => e.id === choixExemple.value);
  choixExemple.value = "";
  if (exemple !== undefined) remplacerFactures(saisieDepuisSite(exemple));
});

listeEtapes.addEventListener("change", (evenement) => {
  const caseFaite = evenement.target;
  if (!(caseFaite instanceof HTMLInputElement)) return;
  const etape = caseFaite.dataset["etape"];
  if (etape === undefined) return;
  modifierDossier((d) => ({
    ...d,
    etapesFaites: caseFaite.checked
      ? [...new Set([...d.etapesFaites, etape])]
      : d.etapesFaites.filter((e) => e !== etape),
  }));
  afficherDossier();
});

listeEtapes.addEventListener("click", (evenement) => {
  const bouton = evenement.target;
  if (!(bouton instanceof HTMLButtonElement) || bouton.dataset["document"] === undefined) return;
  documentOuvert = bouton.dataset["document"] as IdDocument;
  afficherDossier();
  blocDocument.scrollIntoView({ behavior: "smooth", block: "start" });
});

formSuivi.addEventListener("submit", (evenement) => {
  evenement.preventDefault();
  ajouterFactureSuivie();
});

tableSuivi.addEventListener("click", (evenement) => {
  const bouton = evenement.target;
  if (!(bouton instanceof HTMLButtonElement) || bouton.dataset["retirer"] === undefined) return;
  const id = bouton.dataset["retirer"];
  modifierDossier((d) => ({ ...d, suivi: d.suivi.filter((f) => f.id !== id) }));
  afficherDossier();
});

champDejaFacture.addEventListener("input", () => {
  const montant = lireNombre(champDejaFacture.value) ?? 0;
  if (Number.isNaN(montant) || montant < 0) return;
  modifierDossier((d) => ({ ...d, dejaFactureDh: montant }));
  afficherDossier();
});

boutonFermer.addEventListener("click", () => {
  documentOuvert = null;
  blocDocument.hidden = true;
});

boutonImprimer.addEventListener("click", () => {
  document.body.classList.add("impression-document");
  window.print();
});
window.addEventListener("afterprint", () => document.body.classList.remove("impression-document"));

// ---------- Démarrage ----------

chargerDonnees();
remplirPrestataire();
ouvrirDossier(idCourant);
