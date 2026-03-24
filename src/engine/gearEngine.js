const DEFAULT_LIMITS = {
  running_shoes: { km: 600, hours: 80 },
  race_shoes: { km: 350, hours: 40 },
  bike_chain: { km: 3500, hours: 180 },
  bike_tire: { km: 4500, hours: 220 },
  wetsuit: { km: 250, hours: 120 },
  hr_strap: { km: 20000, hours: 500 }
};

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/**
 * @typedef GearItem
 * @property {string} id
 * @property {string} name
 * @property {'running_shoes'|'race_shoes'|'bike_chain'|'bike_tire'|'wetsuit'|'hr_strap'} type
 * @property {number} usageKm
 * @property {number} usageHours
 * @property {number=} cost
 */

/**
 * @param {GearItem[]} items
 */
export function analyzeGear(items) {
  return items.map((item) => {
    const limits = DEFAULT_LIMITS[item.type] ?? { km: 5000, hours: 200 };
    const kmRatio = item.usageKm / limits.km;
    const hourRatio = item.usageHours / limits.hours;
    const wear = Math.max(kmRatio, hourRatio);

    const status = wear >= 1 ? 'replace' : wear >= 0.85 ? 'warning' : 'ok';
    const remainingKm = Math.max(0, Math.round(limits.km - item.usageKm));
    const remainingHours = Math.max(0, Math.round(limits.hours - item.usageHours));
    const costPerKm = item.cost && item.usageKm > 0 ? Number((item.cost / item.usageKm).toFixed(2)) : null;

    const recommendation =
      status === 'replace'
        ? 'Austausch empfohlen, da die Lebensdauer überschritten ist.'
        : status === 'warning'
          ? 'Bald prüfen/ersetzen. Restlebensdauer ist niedrig.'
          : 'Zustand im grünen Bereich.';

    return {
      ...item,
      wearScore: Number(clamp01(wear).toFixed(2)),
      status,
      remainingKm,
      remainingHours,
      costPerKm,
      recommendation
    };
  });
}

/**
 * @param {ReturnType<typeof analyzeGear>} report
 */
export function summarizeGear(report) {
  const counts = report.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { ok: 0, warning: 0, replace: 0 }
  );

  return {
    ...counts,
    total: report.length,
    highestRisk:
      report
        .slice()
        .sort((a, b) => b.wearScore - a.wearScore)
        .slice(0, 3)
        .map((x) => ({ name: x.name, type: x.type, wearScore: x.wearScore, status: x.status }))
  };
}
