import { describe, expect, it } from "vitest";
import {
  DonneesInvalides,
  diagnostiquer,
  estimerTotalTtc,
  validerSite,
  type ReleveMensuel,
  type Site,
} from "../src/lib/diagnostic";
import { HYPOTHESES, TARIF_MT_2026 } from "../src/lib/tarifs";
import { EXEMPLES } from "../src/data/exemples";

const releve = (surcharge: Partial<ReleveMensuel> = {}): ReleveMensuel => ({
  mois: "Janv. 2026",
  jours: 30,
  releveEstime: false,
  kwhPointe: 1000,
  kwhPleines: 3000,
  kwhCreuses: 2000,
  puissanceMaxKva: 100,
  penaliteReactiveDh: 0,
  depassementDh: 0,
  ...surcharge,
});

const douzeMois = (surcharge: Partial<ReleveMensuel> = {}) =>
  Array.from({ length: 12 }, (_, i) => releve({ mois: `M${i + 1}`, ...surcharge }));

describe("diagnostiquer", () => {
  it("chiffre la puissance payée en trop quand la souscription dépasse le besoin", () => {
    const d = diagnostiquer({
      puissanceSouscriteKva: 250,
      releves: douzeMois({ puissanceMaxKva: 152 }),
    });
    expect(d.puissanceConseilleeKva).toBe(168);
    expect(d.reglagePuissance).toBe("trop-haute");
    expect(d.economiePuissanceDh).toBeCloseTo(82 * TARIF_MT_2026.primeFixeDhParKvaAn, 6);
  });

  it("conseille d'augmenter la puissance quand les dépassements coûtent plus que la prime fixe", () => {
    const releves = douzeMois({ puissanceMaxKva: 150 });
    releves[0] = releve({ mois: "M1", puissanceMaxKva: 180, depassementDh: 20000 });
    const d = diagnostiquer({ puissanceSouscriteKva: 160, releves });
    expect(d.reglagePuissance).toBe("trop-basse");
    expect(d.puissanceConseilleeKva).toBe(198);
    expect(d.economiePuissanceDh).toBeCloseTo(20000 - 38 * TARIF_MT_2026.primeFixeDhParKvaAn, 6);
    expect(d.anomalies).toContainEqual({ type: "depassements", montantDh: 20000 });
  });

  it("ne promet jamais d'économie négative sur la puissance", () => {
    const releves = douzeMois({ puissanceMaxKva: 150 });
    releves[0] = releve({ mois: "M1", puissanceMaxKva: 200, depassementDh: 100 });
    const d = diagnostiquer({ puissanceSouscriteKva: 160, releves });
    expect(d.economiePuissanceDh).toBe(0);
  });

  it("considère la puissance correcte quand elle suit le pic sans dépassement", () => {
    const d = diagnostiquer({
      puissanceSouscriteKva: 110,
      releves: douzeMois({ puissanceMaxKva: 100 }),
    });
    expect(d.reglagePuissance).toBe("correcte");
    expect(d.economiePuissanceDh).toBe(0);
  });

  it("applique les hypothèses sur l'énergie réactive et les heures de pointe", () => {
    const d = diagnostiquer({
      puissanceSouscriteKva: 110,
      releves: douzeMois({ puissanceMaxKva: 100, penaliteReactiveDh: 1000 }),
    });
    expect(d.penalitesReactivesDh).toBe(12000);
    expect(d.economieReactiveDh).toBeCloseTo(12000 * HYPOTHESES.partReactiveEvitable, 6);
    const pointe =
      12000 *
      HYPOTHESES.partPointeDeplacable *
      (TARIF_MT_2026.kwhPointeDh - TARIF_MT_2026.kwhPleinesDh);
    expect(d.economiePointeDh).toBeCloseTo(pointe, 6);
    expect(d.perteTotaleDh).toBeCloseTo(d.economieReactiveDh + pointe, 6);
    expect(d.commissionDh).toBeCloseTo(d.perteTotaleDh * HYPOTHESES.commission, 6);
  });

  it("ramène à une année les montants calculés sur moins de 12 factures", () => {
    const sur6 = diagnostiquer({
      puissanceSouscriteKva: 110,
      releves: douzeMois({ puissanceMaxKva: 100, penaliteReactiveDh: 500 }).slice(0, 6),
    });
    expect(sur6.penalitesReactivesDh).toBe(6000);
    expect(sur6.consommationKwh).toBe(72000);
  });

  it("utilise le total saisi et estime seulement les totaux manquants", () => {
    const releves = douzeMois();
    releves[0] = releve({ mois: "M1", totalTtcDh: 10000 });
    const d = diagnostiquer({ puissanceSouscriteKva: 100, releves });
    const estime = estimerTotalTtc(releve(), 100);
    expect(d.totalPayeDh).toBeCloseTo(10000 + 11 * estime, 6);
  });

  it("signale les relevés estimés et les périodes trop longues", () => {
    const releves = douzeMois();
    releves[2] = releve({ mois: "Mars", releveEstime: true });
    releves[4] = releve({ mois: "Mai", jours: 35 });
    releves[5] = releve({ mois: "Juin", jours: 33 });
    const d = diagnostiquer({ puissanceSouscriteKva: 120, releves });
    expect(d.anomalies).toEqual([
      { type: "releve-estime", mois: "Mars" },
      { type: "periode-longue", mois: "Mai", jours: 35 },
    ]);
  });

  it("refuse les données incomplètes ou négatives", () => {
    expect(() => diagnostiquer({ puissanceSouscriteKva: 100, releves: [] })).toThrow(
      DonneesInvalides,
    );
    expect(() => diagnostiquer({ puissanceSouscriteKva: 0, releves: douzeMois() })).toThrow(
      DonneesInvalides,
    );
    const site: Site = { puissanceSouscriteKva: 100, releves: [releve({ kwhPointe: -1 })] };
    expect(validerSite(site)).toHaveLength(1);
    expect(
      validerSite({ puissanceSouscriteKva: 100, releves: [releve({ jours: Number.NaN })] }),
    ).toHaveLength(1);
  });
});

describe("exemples de démonstration", () => {
  it("donnent chacun un cas différent", () => {
    const reglages = EXEMPLES.map((e) => diagnostiquer(e).reglagePuissance);
    expect(reglages).toEqual(["trop-haute", "correcte", "trop-basse"]);
  });

  it("sont tous valides et couvrent 12 mois", () => {
    for (const exemple of EXEMPLES) {
      expect(validerSite(exemple)).toEqual([]);
      expect(exemple.releves).toHaveLength(12);
    }
  });
});
