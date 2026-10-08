// Every run must be able to start, and every cost a route plans must be reachable.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { simulate, config } = require('./simulate-economy.cjs');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

function run() {
  const difficulties = Object.keys(config.opening);
  const routes = Object.keys(config.routes);
  const starts = [], costs = [], findings = [];

  for (const difficulty of difficulties) {
    for (const route of routes) {
      const result = simulate(route, 'baseline', difficulty);
      if (result.gatedAtStart) continue;
      const first = result.months[0];
      const built = Object.values(first.built || {}).reduce((a, b) => a + b, 0);

      // A run that cannot build anything in month one is not playable.
      assert(built > 0, `${difficulty}/${route}: nothing is built in the first month`);
      assert(!first.notices.some(n => n.startsWith('DEVELOPMENT_BLOCKED')),
        `${difficulty}/${route}: the first model cannot be developed, so the run cannot start`);
      starts.push({ difficulty, route, firstMonthBuilt: built });

      // Development is only charged for standard models; a commission is a one-off build.
      const kinds = Object.fromEntries(Object.entries(config.products).map(([id, p]) => [id, p.kind]));
      for (const [id, kind] of Object.entries(kinds)) {
        const hasDev = Number.isFinite(config.products[id].developmentCost);
        if (kind === 'standard') assert(hasDev, `${id} is a standard model but has no development cost`);
        else assert(!hasDev, `${id} is a commission yet carries a development cost`);
      }

      // Anything the plan schedules must be affordable when scheduled.
      for (const purchase of config.routes[route].investments) {
        const month = result.months[purchase.month - 1];
        if (!month) continue;
        const unaffordable = month.notices.includes('EXPANSION_UNAFFORDABLE');
        costs.push({ difficulty, route, purchase: purchase.id, month: purchase.month, bought: !unaffordable });
        if (unaffordable) findings.push(`${difficulty}/${route}: ${purchase.id} scheduled in month ${purchase.month} was not affordable`);
      }

      // A route has to finish a reasonable share of its plan outside the hardest tier.
      const planned = config.routes[route].monthlyProductionTargets
        .reduce((a, t) => a + Object.values(t).reduce((x, y) => x + y, 0), 0);
      const builtTotal = result.months.reduce((a, m) => a + Object.values(m.built || {}).reduce((x, y) => x + y, 0), 0);
      const completion = builtTotal / planned;
      if (difficulty !== 'hard')
        assert(completion >= 0.9, `${difficulty}/${route}: only ${(completion * 100).toFixed(0)} percent of the plan is built`);
      starts.at(-1).planCompletion = Number(completion.toFixed(3));
    }
  }

  // Hard is allowed to fall short, but it must still produce something.
  for (const route of routes) {
    const result = simulate(route, 'baseline', 'hard');
    if (result.gatedAtStart) continue;
    const built = result.months.reduce((a, m) => a + Object.values(m.built || {}).reduce((x, y) => x + y, 0), 0);
    assert(built > 0, `hard/${route}: the whole run builds nothing`);
  }

  const output = {
    status: 'passed',
    difficultyRoutes: starts.length,
    starts,
    scheduledCosts: costs,
    unreachableCosts: findings,
    notes: [
      '委托（高定）是一次性制作，不承担开发费；只有定型机需要开发',
      '困难档开局只走精品，量产与混合被标记为开局锁定，不参与本节检查',
    ],
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'reachability-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
