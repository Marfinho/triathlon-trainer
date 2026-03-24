function weekKey(dateStr) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const days = Math.floor((date.getTime() - first.getTime()) / (24 * 3600 * 1000));
  const week = Math.floor(days / 7) + 1;
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * @param {Array<{date:string,sport:string,durationMinutes:number,zone:number,status?:string}>} workouts
 */
export function buildDashboardSummary(workouts) {
  const weekMap = new Map();
  const zoneTotals = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
  const statusCounts = { planned: 0, done: 0, missed: 0 };

  for (const w of workouts) {
    const key = weekKey(w.date);
    const row = weekMap.get(key) ?? { totalMinutes: 0, swim: 0, bike: 0, run: 0, strength: 0, rest: 0 };
    row.totalMinutes += w.durationMinutes || 0;
    row[w.sport] = (row[w.sport] ?? 0) + (w.durationMinutes || 0);
    weekMap.set(key, row);

    zoneTotals[`z${Math.min(5, Math.max(1, w.zone))}`] += 1;
    statusCounts[w.status ?? 'planned'] = (statusCounts[w.status ?? 'planned'] ?? 0) + 1;
  }

  const weekRows = [...weekMap.entries()].map(([week, values]) => ({ week, ...values }));
  weekRows.sort((a, b) => a.week.localeCompare(b.week));

  const totalSessions = workouts.length || 1;
  const consistency = Number(((statusCounts.done / totalSessions) * 100).toFixed(1));

  return {
    weeks: weekRows,
    zoneDistribution: {
      easy: Number((((zoneTotals.z1 + zoneTotals.z2) / totalSessions) * 100).toFixed(1)),
      moderate: Number(((zoneTotals.z3 / totalSessions) * 100).toFixed(1)),
      hard: Number((((zoneTotals.z4 + zoneTotals.z5) / totalSessions) * 100).toFixed(1))
    },
    consistency,
    statusCounts,
    explanation:
      consistency < 65
        ? 'Planerfüllung ist aktuell niedrig. Fokus auf Regelmäßigkeit vor Intensität.'
        : 'Planerfüllung solide. Belastung kann kontrolliert progressiv gesteigert werden.'
  };
}
