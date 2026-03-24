import { buildDashboardSummary } from './analyticsEngine.js';
import { buildLoadMetrics } from './loadModelEngine.js';
import { evaluateRules } from './ruleEngine.js';

/**
 * Build a unified dashboard payload for UI consumption.
 * @param {Array<{date:string,sport:string,durationMinutes:number,zone:number,status?:string,executedZone?:number}>} workouts
 * @param {{today?:string,races?:Array<{id:string,date:string,priority?:'A'|'B'|'C'}>,metrics?:{bikeTrend?:number,runTrend?:number},userId?:string}} [context]
 * @param {{listByUser:(userId?:string,limit?:number)=>Array<any>}} [adjustmentStore]
 */
export function buildFullDashboard(workouts, context = {}, adjustmentStore) {
  if (!Array.isArray(workouts)) throw new Error('workouts must be an array');

  const summary = buildDashboardSummary(workouts);
  const load = buildLoadMetrics(workouts);
  const rules = evaluateRules(workouts, context);
  const adjustments = adjustmentStore ? adjustmentStore.listByUser(context.userId, 5) : [];

  return {
    generatedAt: new Date().toISOString(),
    summary,
    load,
    rules,
    adjustments,
    explanation:
      'Vereinte Dashboard-Sicht mit Volumen, Ermüdung, Regel-Hinweisen und jüngsten Plananpassungen für schnelle Coach-Entscheidungen.'
  };
}
