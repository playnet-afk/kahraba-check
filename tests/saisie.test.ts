import { describe, expect, it } from "vitest";
import { EXEMPLES } from "../src/data/exemples";
import {
  lireLignes,
  lireNombre,
  lireSaisie,
  saisieDepuisSite,
  type LigneSaisie,
} from "../src/lib/saisie";

const ligneVide: LigneSaisie = {
  mois: "",
  jours: "",
  releveEstime: false,
  kwhPointe: "",
  kwhPleines: "",
  kwhCreuses: "",
  puissanceMaxKva: "",
  penaliteReactiveDh: "",
  depassementDh: "",
  totalTtcDh: "",
};

const ligne = (surcharge: Partial<LigneSaisie>): LigneSaisie => ({
  ...ligneVide,
  kwhPointe: "1000",
  kwhPleines: "3000",
  kwhCreuses: "2000",
  puissanceMaxKva: "120",
  ...surcharge,
});

describe("lireNombre", () => {
  it("accepte les écritures françaises et anglaises", () => {
    expect(lireNombre("12 500,5")).toBe(12500.5);
    expect(lireNombre("12500.5")).toBe(12500.5);
    expect(lireNombre("12 500")).toBe(12500);
    expect(lireNombre("4 800 DH")).toBe(4800);
    expect(lireNombre(" 250 kVA ")).toBe(250);
  });

  it("distingue un champ vide d'une saisie illisible", () => {
    expect(lireNombre("   ")).toBeNull();
    expect(lireNombre("douze")).toBeNaN();
    expect(lireNombre("1,2,3")).toBeNaN();
  });
});

describe("lireLignes", () => {
  it("ignore les lignes vides et complète les valeurs par défaut", () => {
    const resultat = lireLignes([ligne({ mois: "Janv." }), ligneVide]);
    expect(resultat).toEqual({
      ok: true,
      releves: [
        {
          mois: "Janv.",
          jours: 30,
          releveEstime: false,
          kwhPointe: 1000,
          kwhPleines: 3000,
          kwhCreuses: 2000,
          puissanceMaxKva: 120,
          penaliteReactiveDh: 0,
          depassementDh: 0,
        },
      ],
    });
  });

  it("garde le total TTC quand il est saisi", () => {
    const resultat = lireLignes([ligne({ totalTtcDh: "18 400" })]);
    expect(resultat.ok && resultat.releves[0]?.totalTtcDh).toBe(18400);
  });

  it("nomme le mois et le champ fautifs", () => {
    const resultat = lireLignes([ligne({ puissanceMaxKva: "" }), ligne({ jours: "-3" })]);
    expect(resultat).toEqual({
      ok: false,
      erreurs: [
        "Mois 1 : il manque la puissance maximale atteinte.",
        "Mois 2 : valeur invalide pour le nombre de jours (nombre positif attendu).",
      ],
    });
  });

  it("refuse un tableau sans aucune facture", () => {
    expect(lireLignes([ligneVide, ligneVide])).toEqual({
      ok: false,
      erreurs: ["Renseignez au moins une facture."],
    });
  });
});

describe("lireSaisie", () => {
  it("exige une puissance souscrite positive", () => {
    const resultat = lireSaisie({ puissanceSouscriteKva: "0", lignes: [ligne({})] });
    expect(resultat.ok).toBe(false);
  });

  it("retrouve un exemple après un aller-retour par la saisie", () => {
    for (const exemple of EXEMPLES) {
      const resultat = lireSaisie(saisieDepuisSite(exemple));
      expect(resultat).toEqual({
        ok: true,
        site: { puissanceSouscriteKva: exemple.puissanceSouscriteKva, releves: exemple.releves },
      });
    }
  });
});
