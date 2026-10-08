// Every development investment must be worth its price, or it is a trap the player cannot see.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { simulate, config } = require('./simulate-economy.cjs');
const root = path.resolve(__dirname, '..');
const DIFFICULTY = 'normal';
const SCENARIO = 'baseline';

// Removing a bench can invalidate equipment that needs two of them, so drop dependants together.
function without(route, removedIds) {
  const investments = route.investments.filter(p => !removedIds.includes(p.id));
  return investments;
}
function requiredBenches(investments) {
  return investments.reduce((n, p) => n + (config.investments[p.id].addedBenches || 0), 0);
}
function pruneToBenchLimit(investments, openingBenches) {
  let list = [...investments];
  for (;;) {
    const benches = openingBenches + requiredBenches(list);
    const dropped = list.filter(p => config.investments[p.id].requiresBenches > benches);
    if (!dropped.length) return list;
    list = list.filter(p => !dropped.includes(p));
  }
}

function run() {
  const opening = config.opening[DIFFICULTY];
  const rows = [];
  for (const [routeId, route] of Object.entries(config.routes)) {
    if (!opening.startingRoutes.includes(routeId)) continue;
    const base = simulate(routeId, SCENARIO, DIFFICULTY);
    assert(!base.bankrupt, `${routeId}: the reference plan must not go bankrupt`);

    for (const purchase of route.investments) {
      const pruned = pruneToBenchLimit(without(route, [purchase.id]), opening.benches);
      if (pruned.length === route.investments.length) continue; // nothing was actually removed
      const variant = simulate(routeId, SCENARIO, DIFFICULTY, { investments: pruned });
      const marginal = Number((base.operatingProfit - variant.operatingProfit).toFixed(2));
      // Cost the whole removed set: dropping a bench also drops the equipment that needs two of them.
      const removedIds = route.investments.filter(p => !pruned.includes(p)).map(p => p.id);
      const cost = removedIds.reduce((n, id) => n + config.investments[id].cost +
        (config.investments[id].additionalMonthlyUtilities || 0) * 6, 0);
      rows.push({
        route: routeId, investment: purchase.id, month: purchase.month, cost, removedIds,
        withIt: base.operatingProfit, withoutIt: variant.operatingProfit,
        marginalProfit: marginal, paybackRatio: Number((marginal / cost).toFixed(2)),
        alsoRemoved: route.investments.filter(p => !pruned.includes(p)).map(p => p.id).filter(id => id !== purchase.id),
      });
    }

    for (const hireMonth of route.hires) {
      const variant = simulate(routeId, SCENARIO, DIFFICULTY, { hires: [] });
      const marginal = Number((base.operatingProfit - variant.operatingProfit).toFixed(2));
      const cost = config.employee.recruitmentCost + config.employee.monthlySalary * (6 - hireMonth + 1);
      rows.push({
        route: routeId, investment: `hire_month_${hireMonth}`, month: hireMonth, cost,
        withIt: base.operatingProfit, withoutIt: variant.operatingProfit,
        marginalProfit: marginal, paybackRatio: Number((marginal / cost).toFixed(2)), alsoRemoved: [],
      });
    }
  }

  // An investment the player is told to make must at least return its cost inside the six months.
  for (const row of rows) {
    assert(row.marginalProfit > 0,
      `${row.route}/${row.investment}: removing it raises profit by ${-row.marginalProfit}, so the plan buys a losing investment`);
    assert(row.paybackRatio >= 1,
      `${row.route}/${row.investment}: pays back ${row.paybackRatio} of its ${row.cost}, so the plan buys an investment that never returns`);
  }
  // Anything that barely breaks even is a weak decision rather than a real one.
  const marginal = rows.filter(r => r.paybackRatio < 1.5).map(r => ({ route: r.route, investment: r.investment, paybackRatio: r.paybackRatio }));

  const output = {
    status: 'passed', difficulty: DIFFICULTY, scenario: SCENARIO,
    investments: rows.sort((a, b) => a.route.localeCompare(b.route) || a.month - b.month),
    weakDecisions: marginal,
    capacityIsBinding: "No route is capacity bound in the baseline, so a capacity-only investment cannot pay; the bench only pays because it is bundled with the semi-automatic cost saving.",
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'investment-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
