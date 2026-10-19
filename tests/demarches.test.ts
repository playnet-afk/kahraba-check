import { describe, expect, it } from "vitest";
import { EXEMPLES, type Exemple } from "../src/data/exemples";
import { etapes } from "../src/lib/demarches";
import { diagnostiquer } from "../src/lib/diagnostic";
import { champsManquants, genererDocument, type Contexte } from "../src/lib/documents";
import { lireDossiers, nouveauDossier, PRESTATAIRE_VIDE } from "../src/lib/dossier";
import { saisieDepuisSite } from "../src/lib/saisie";
import { bilanSuivi, economieMensuelle } from "../src/lib/suivi";
import { TARIF_MT_2026 } from "../src/lib/tarifs";

const exemple = (id: string): Exemple => {
  const trouve = EXEMPLES.find((e) => e.id === id);
  if (trouve === undefined) throw new Error(`Exemple introuvable : ${id}`);
  return trouve;
};

const contexte = (site: Exemple): Contexte => {
  const dossier = {
    ...nouveauDossier("d1", new Date("2026-10-19"), 0.4),
    factures: saisieDepuisSite(site),
  };
  return {
    prestataire: PRESTATAIRE_VIDE,
    dossier,
    site,
    diagnostic: diagnostiquer(site),
    bilan: bilanSuivi(site, [], 0.4, 0),
    date: new Date("2026-10-19T12:00:00Z"),
  };
};

describe("etapes", () => {
  it("ne propose que les démarches utiles au dossier", () => {
    const hotel = exemple("hotel");
    const ids = etapes(diagnostiquer(hotel), hotel.puissanceSouscriteKva).map((e) => e.id);
    expect(ids).toEqual([
      "contrat",
      "puissance",
      "reclamation",
      "condensateurs",
      "pointe",
      "suivi",
      "facturation",
    ]);

    const clinique = exemple("clinique");
    const idsClinique = etapes(diagnostiquer(clinique), clinique.puissanceSouscriteKva).map(
      (e) => e.id,
    );
    expect(idsClinique).not.toContain("puissance");
  });

  it("annonce une hausse de puissance quand les dépassements coûtent trop cher", () => {
    const froid = exemple("froid");
    const etape = etapes(diagnostiquer(froid), froid.puissanceSouscriteKva).find(
      (e) => e.id === "puissance",
    );
    expect(etape?.titre).toMatch(/^Augmenter la puissance souscrite de 160 à \d+ kVA$/);
  });
});

describe("genererDocument", () => {
  it("reprend les chiffres de l'analyse dans la lettre de puissance", () => {
    const ctx = contexte(exemple("hotel"));
    const lettre = genererDocument("lettre-puissance", ctx);
    const texte = JSON.stringify(lettre.blocs);
    expect(texte).toContain("demande de réduction de la puissance souscrite");
    expect(texte).toContain("de 250 kVA à 168 kVA");
  });

  it("signale les informations qui restent à compléter", () => {
    const ctx = contexte(exemple("hotel"));
    const manquants = champsManquants(genererDocument("contrat", ctx));
    expect(manquants).toContain("[raison sociale du client]");
    expect(manquants).toContain("[votre raison sociale]");
  });

  it("n'affiche plus de repère une fois le dossier complété", () => {
    const base = contexte(exemple("hotel"));
    const ctx: Contexte = {
      ...base,
      prestataire: {
        nom: "Karim Alaoui",
        raisonSociale: "Kahraba Check SARL",
        adresse: "12 rue Atlas",
        ville: "Marrakech",
        telephone: "0600000000",
        email: "contact@exemple.ma",
        ice: "001",
        rc: "123",
      },
      dossier: {
        ...base.dossier,
        client: {
          raisonSociale: "Hôtel Atlas",
          representant: "Sara Bennani",
          fonction: "Directrice",
          adresse: "Avenue Mohammed VI",
          ville: "Marrakech",
          ice: "002",
          telephone: "0611111111",
          email: "direction@exemple.ma",
        },
        abonnement: {
          distributeur: "SRM Marrakech-Safi",
          referenceContrat: "MT-42",
          adresseSite: "",
        },
      },
    };
    expect(champsManquants(genererDocument("lettre-puissance", ctx))).toEqual([]);
  });
});

describe("suivi des économies", () => {
  const hotel = exemple("hotel");
  const reference = hotel.releves[0];
  if (reference === undefined) throw new Error("Relevé manquant.");

  const facture = {
    id: "f1",
    indexReference: 0,
    mois: "Oct. 2026",
    puissanceSouscriteKva: 168,
    kwhPointe: reference.kwhPointe,
    kwhPleines: reference.kwhPleines,
    kwhCreuses: reference.kwhCreuses,
    penaliteReactiveDh: 100,
    depassementDh: 0,
  };

  it("chiffre chaque poste par rapport au même mois de référence", () => {
    const e = economieMensuelle(hotel, facture);
    expect(e.moisReference).toBe(reference.mois);
    expect(e.puissanceDh).toBeCloseTo((82 * TARIF_MT_2026.primeFixeDhParKvaAn) / 12, 6);
    expect(e.reactiveDh).toBe(reference.penaliteReactiveDh - 100);
    expect(e.pointeDh).toBeCloseTo(0, 6);
  });

  it("calcule la commission et ce qui reste à facturer", () => {
    const bilan = bilanSuivi(hotel, [facture], 0.4, 1000);
    expect(bilan.commissionAcquiseDh).toBeCloseTo(bilan.totalDh * 0.4, 6);
    expect(bilan.resteAFacturerDh).toBeCloseTo(bilan.commissionAcquiseDh - 1000, 6);
  });

  it("ne facture rien quand les économies sont négatives", () => {
    const hausse = { ...facture, puissanceSouscriteKva: 300, penaliteReactiveDh: 9000 };
    const bilan = bilanSuivi(hotel, [hausse], 0.4, 0);
    expect(bilan.totalDh).toBeLessThan(0);
    expect(bilan.resteAFacturerDh).toBe(0);
  });

  it("refuse un mois de référence inexistant", () => {
    expect(() => economieMensuelle(hotel, { ...facture, indexReference: 40 })).toThrow();
  });
});

describe("lireDossiers", () => {
  it("complète les champs absents d'une ancienne sauvegarde", () => {
    const [dossier] = lireDossiers([{ id: "a", client: { raisonSociale: "Riad" } }]);
    expect(dossier?.client.raisonSociale).toBe("Riad");
    expect(dossier?.client.ville).toBe("");
    expect(dossier?.suivi).toEqual([]);
  });

  it("rejette un fichier qui n'est pas une liste de dossiers", () => {
    expect(() => lireDossiers({ id: "a" })).toThrow();
    expect(() => lireDossiers([{ nom: "sans id" }])).toThrow();
  });
});
