import { describe, expect, it } from "vitest";
import { regimeAutoproduction, simulerSolaire } from "../src/lib/solaire";

describe("regimeAutoproduction", () => {
  it("suit les seuils de la loi 82-21", () => {
    expect(regimeAutoproduction(10.9)).toBe("declaration");
    expect(regimeAutoproduction(11)).toBe("accord-distributeur");
    expect(regimeAutoproduction(5000)).toBe("accord-distributeur");
    expect(regimeAutoproduction(5001)).toBe("autorisation-onee");
  });
});

describe("simulerSolaire", () => {
  const base = {
    consommationAnnuelleKwh: 600000,
    partJournee: 0.5,
    tauxCouverture: 0.8,
    prixInstalleDhParWc: 7,
  };

  it("dimensionne sur la consommation de journée", () => {
    const s = simulerSolaire(base);
    expect(s.puissanceKwc).toBe(Math.round((300000 * 0.8) / 1650));
    expect(s.productionKwh).toBe(s.puissanceKwc * 1650);
    expect(s.autoconsommeKwh).toBe(s.productionKwh);
    expect(s.surplusVenduKwh).toBe(0);
    expect(s.investissementDh).toBe(s.puissanceKwc * 7000);
    expect(s.retourAnnees).toBeCloseTo(s.investissementDh / s.economieAnnuelleDh, 6);
    expect(s.regime).toBe("accord-distributeur");
  });

  it("plafonne le surplus revendu à 20 % de la production", () => {
    const s = simulerSolaire({
      ...base,
      partJournee: 0.1,
      tauxCouverture: 1,
      productibleKwhParKwc: 1000,
    });
    // Production forcée au-dessus du besoin en réduisant la journée après dimensionnement.
    const surdimensionne = simulerSolaire({
      ...base,
      partJournee: 0.05,
      tauxCouverture: 1,
      productibleKwhParKwc: 10,
    });
    expect(s.surplusPerduKwh).toBe(0);
    expect(surdimensionne.surplusVenduKwh).toBeLessThanOrEqual(surdimensionne.productionKwh * 0.2);
  });

  it("ne produit rien sans consommation", () => {
    const s = simulerSolaire({ ...base, consommationAnnuelleKwh: 0 });
    expect(s.puissanceKwc).toBe(0);
    expect(s.retourAnnees).toBeNull();
  });

  it("borne les parts saisies entre 0 et 1", () => {
    const s = simulerSolaire({ ...base, partJournee: 2, tauxCouverture: -1 });
    expect(s.puissanceKwc).toBe(1);
  });
});
