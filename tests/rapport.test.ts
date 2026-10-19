import { describe, expect, it } from "vitest";
import { EXEMPLES } from "../src/data/exemples";
import { diagnostiquer } from "../src/lib/diagnostic";
import { conseils, decrireAnomalie } from "../src/lib/rapport";

describe("conseils", () => {
  it("classe les actions de la plus rentable à la moins rentable", () => {
    for (const exemple of EXEMPLES) {
      const liste = conseils(diagnostiquer(exemple), exemple.puissanceSouscriteKva);
      const montants = liste.map((c) => c.montantDh);
      expect(montants).toEqual([...montants].sort((a, b) => b - a));
      expect(montants.every((m) => m > 0)).toBe(true);
    }
  });

  it("propose de baisser la puissance quand elle est trop haute", () => {
    const hotel = EXEMPLES.find((e) => e.id === "hotel");
    if (hotel === undefined) throw new Error("Exemple hôtel introuvable.");
    const titres = conseils(diagnostiquer(hotel), hotel.puissanceSouscriteKva).map((c) => c.titre);
    expect(titres).toContain("Baisser la puissance souscrite à 168 kVA");
  });
});

describe("decrireAnomalie", () => {
  it("décrit chaque type d'anomalie", () => {
    expect(decrireAnomalie({ type: "releve-estime", mois: "Mars" })).toMatch(
      /^Mars : relevé estimé/,
    );
    expect(decrireAnomalie({ type: "periode-longue", mois: "Mai", jours: 35 })).toContain(
      "35 jours",
    );
    expect(decrireAnomalie({ type: "depassements", montantDh: 1200 })).toContain("DH par an");
  });
});
