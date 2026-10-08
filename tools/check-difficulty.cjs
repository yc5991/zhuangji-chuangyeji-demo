// Hard must be harder than normal, and normal harder than easy, everywhere - not just on average.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

const config = read('economy-candidate.json');
const results = read('economy-review-results.json').results;
const ORDER = ['easy', 'normal', 'hard'];
const { simulate } = require('./simulate-economy.cjs');

const cell = (difficulty, route, scenario) =>
  results.find(x => x.difficulty === difficulty && x.route === route && x.scenario === scenario);

function run() {
  const routes = Object.keys(config.routes);
  const scenarios = Object.keys(config.scenarios);
  const inversions = [];
  const comparisons = [];

  for (let i = 0; i < ORDER.length - 1; i++) {
    const easier = ORDER[i], harder = ORDER[i + 1];
    for (const route of routes) {
      for (const scenario of scenarios) {
        const a = cell(easier, route, scenario), b = cell(harder, route, scenario);
        assert(a && b, `${easier}/${harder} ${route} ${scenario}: missing result`);
        // A route the harder tier does not start with cannot be compared.
        if (a.gatedAtStart || b.gatedAtStart) continue;
        const row = {
          easier, harder, route, scenario,
          easierProfit: a.operatingProfit, harderProfit: b.operatingProfit,
          easierCash: a.endCash, harderCash: b.endCash,
          easierBankrupt: a.bankrupt, harderBankrupt: b.bankrupt,
        };
        comparisons.push(row);
        if (b.operatingProfit >= a.operatingProfit) inversions.push({ ...row, kind: 'profit' });
        if (b.endCash >= a.endCash) inversions.push({ ...row, kind: 'cash' });
        if (a.bankrupt && !b.bankrupt) inversions.push({ ...row, kind: 'survival' });
      }
    }
  }

  // Build the message only when there is something to report.
  if (inversions.length) {
    const first = inversions[0];
    assert.fail(`${inversions.length} difficulty inversions, first: ${first.harder} beats ${first.easier} on ${first.kind} for ${first.route}/${first.scenario}`);
  }

  // A harder tier must survive no longer, measured in months of losses it can absorb.
  const tolerance = {};
  for (const difficulty of ORDER) {
    const cash0 = config.opening[difficulty].cash;
    let worst = 0;
    for (const route of routes) {
      const row = cell(difficulty, route, 'baseline');
      if (row.gatedAtStart) continue;
      let prev = cash0;
      for (const m of row.months) { const delta = m.endCash - prev; prev = m.endCash; if (delta < worst) worst = delta; }
    }
    tolerance[difficulty] = { worstMonth: Math.round(worst), months: Number((cash0 / Math.abs(worst || 1)).toFixed(1)) };
  }
  assert(tolerance.easy.months > tolerance.normal.months,
    `easy absorbs ${tolerance.easy.months} losing months against normal's ${tolerance.normal.months}`);
  assert(tolerance.normal.months > tolerance.hard.months,
    `normal absorbs ${tolerance.normal.months} losing months against hard's ${tolerance.hard.months}`);

  // Bankruptcy must get more likely as difficulty rises, never less.
  const bankruptcies = {};
  for (const difficulty of ORDER) {
    bankruptcies[difficulty] = results.filter(x => x.difficulty === difficulty && x.bankrupt && !x.gatedAtStart).length;
  }
  assert(bankruptcies.easy <= bankruptcies.normal, `easy goes bankrupt ${bankruptcies.easy} times against normal's ${bankruptcies.normal}`);
  assert(bankruptcies.normal <= bankruptcies.hard, `normal goes bankrupt ${bankruptcies.normal} times against hard's ${bankruptcies.hard}`);

  // The confirmed rule is that mixed earns the most of the three routes. Reputation above one
  // may or may not grow the reachable pool, and that setting can break the rule, so every
  // setting has to be measured rather than assumed.
  const growsSettings = ["none", "bespoke", "all"];
  const routeRule = {};
  for (const grows of growsSettings) {
    const profits = {};
    for (const route of ["boutique", "scale", "mixed"])
      profits[route] = simulate(route, "baseline", "normal", { reputationGrowsPool: grows }).operatingProfit;
    routeRule[grows] = {
      boutique: Math.round(profits.boutique),
      scale: Math.round(profits.scale),
      mixed: Math.round(profits.mixed),
      boutiqueBelowScale: profits.boutique < profits.scale,
      mixedHighest: profits.mixed > profits.boutique && profits.mixed > profits.scale,
      mixedBelowSum: profits.mixed < profits.boutique + profits.scale,
    };
  }
  const shipped = config.opening.normal.reputationGrowsPool || "none";
  const active = routeRule[shipped];
  assert(active.boutiqueBelowScale && active.mixedHighest && active.mixedBelowSum,
    "the shipped reputation setting " + shipped + " breaks a confirmed route rule: " + JSON.stringify(active));
  const breaking = growsSettings.filter(g => !routeRule[g].mixedHighest);
  
  const output = {
    status: 'passed',
    order: ORDER,
    comparisons: comparisons.length,
    inversions: inversions.length,
    lossToleranceMonths: tolerance,
    bankruptcyCounts: bankruptcies,
    gatedRoutes: Object.fromEntries(ORDER.map(d => [d, config.opening[d].startingRoutes])),
    routeRuleByReputationSetting: routeRule,
    reputationSettingsBreakingMixedHighest: breaking,
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'difficulty-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
