import {DATA} from './data';
import type {ComputerDesign, TestReport} from './types';

/**
 * The failure, quality-control and arrival-defect rules, mirroring design/reliability-model.json.
 *
 * The balance model implements the same rules in tools/simulate-economy.cjs; the two cannot share
 * code because one is TypeScript and the other CommonJS, so the formulas are kept identical by hand
 * and the design file is the single source of the numbers.
 */

/** How often a build goes wrong, from the workshop's competence and how stressed the design is. */
export function failureRate(design: ComputerDesign, report: TestReport, gradeMultiplier = 1): number {
  const r = DATA.reliability.failureRate;
  let rate = r.base * gradeMultiplier;
  const unstable = report.coolingRatio < 1;
  // The model applies the thermal multiplier and then the delivery-issue one, and both fire on the
  // same condition, so an unstable build is multiplied twice. That is deliberate here for the same
  // reason it is there: an unstable machine is much more likely to go wrong than a merely warm one.
  if (unstable) rate *= r.conditionMultipliers.thermallyUnstable;
  if (report.headroom < r.conditionMultipliers.powerHeadroomThreshold)
    rate *= r.conditionMultipliers.powerHeadroomBelowThreshold;
  if (unstable) rate *= r.conditionMultipliers.deliveryIssueUnstable;
  return Math.min(r.ceiling, rate);
}

/** How much of the testing time was spent, which decides how many faults reach the customer. */
export function escapeRate(testStationHours: number): number {
  const qc = DATA.reliability.qualityControl;
  if (testStationHours >= qc.minimalTestingHours) return qc.escapeRateWithMinimalTesting;
  if (testStationHours >= qc.caughtWhenTestHoursAtLeast) return qc.escapeRateWithPartialTesting;
  return qc.escapeRateWithoutTesting;
}

/** What a fault costs in money when it happens in the workshop rather than at the customer. */
export function reworkCost(failRate: number, expectedPartsCost: number): number {
  const rw = DATA.reliability.rework;
  return failRate * (rw.consumablesCoins + rw.partReplacementChance * expectedPartsCost);
}

/** What a fault costs when it escapes: the sale is refunded and the machine shipped back. */
export function escapeCost(failRate: number, escaped: number, price: number): number {
  const ad = DATA.reliability.arrivalDefect;
  return failRate * escaped * (price * ad.refundFraction + ad.logisticsCoins);
}
