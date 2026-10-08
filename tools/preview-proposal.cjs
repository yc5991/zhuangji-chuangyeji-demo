// Apply the proposed decisions in a preview harness and check every invariant before they ship.
const fs = require('node:fs');
const path = require('node:path');
const { simulate, config, failureRateFor } = require('./simulate-economy.cjs');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

// Decision 1: raise commission hours, grow mixed's plan, move its expansion to month five.
// Decision 2: raise every price half way to its measured optimum.
// Decision 4: let a reputation above one grow every customer pool.
const PROPOSAL = {
  hours: { quiet_office: { designHours: 14, assemblyHours: 20 }, premium: { designHours: 32, assemblyHours: 45 } },
  prices: { office: 2202, gaming: 4743, quiet_office: 5391, premium: 11724 },
  mixedPlanFactor: 1.3,
  mixedInvestments: [{ month: 3, id: 'craft_tools' }, { month: 5, id: 'bench' }],
  mixedHires: [5],
  reputationGrowsPool: 'all',
};

function proposal() {
  const products = JSON.parse(JSON.stringify(config.products));
  for (const [id, v] of Object.entries(PROPOSAL.hours)) Object.assign(products[id], v);
  for (const [id, v] of Object.entries(PROPOSAL.prices)) products[id].salePrice = v;
  const routes = JSON.parse(JSON.stringify(config.routes));
  routes.mixed.monthlyProductionTargets = routes.mixed.monthlyProductionTargets.map(
    t => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Math.round(v * PROPOSAL.mixedPlanFactor)])));
  routes.mixed.investments = PROPOSAL.mixedInvestments;
  routes.mixed.hires = PROPOSAL.mixedHires;
  return { products, routes };
}

function run() {
  const { products, routes } = proposal();
  const go = (route, scenario, difficulty) => simulate(route, scenario, difficulty,
    { products, ...(route === 'mixed' ? { monthlyProductionTargets: routes.mixed.monthlyProductionTargets,
      investments: routes.mixed.investments, hires: routes.mixed.hires } : {}),
      reputationGrowsPool: PROPOSAL.reputationGrowsPool });

  const difficulties = Object.keys(config.opening);
  const scenarios = Object.keys(config.scenarios);
  const routeIds = Object.keys(config.routes);
  const failures = [];

  // 1. The confirmed route relationships, on the baseline of every difficulty.
  // A route the tier does not start with only reports fixed costs, so it cannot be compared.
  const baseline = {};
  for (const d of difficulties) {
    const rows = Object.fromEntries(routeIds.map(r => [r, go(r, 'baseline', d)]));
    baseline[d] = Object.fromEntries(routeIds.map(r => [r, rows[r].gatedAtStart ? null : rows[r].operatingProfit]));
    if (!rows.boutique.gatedAtStart && !rows.scale.gatedAtStart) {
      const b = rows.boutique.operatingProfit, s = rows.scale.operatingProfit;
      if (!(b < s)) failures.push(`${d}: boutique ${Math.round(b)} is not below scale ${Math.round(s)}`);
      if (!rows.mixed.gatedAtStart) {
        const m = rows.mixed.operatingProfit;
        if (!(m > b && m > s)) failures.push(`${d}: mixed ${Math.round(m)} does not beat both`);
        if (!(m < b + s)) failures.push(`${d}: mixed ${Math.round(m)} is not below the sum ${Math.round(b + s)}`);
      }
    }
  }

  // 2. Difficulty ordering: the harder tier must never do better.
  let comparisons = 0;
  for (let i = 0; i < difficulties.length - 1; i++) {
    for (const r of routeIds) for (const sc of scenarios) {
      const a = go(r, sc, difficulties[i]), b = go(r, sc, difficulties[i + 1]);
      if (a.gatedAtStart || b.gatedAtStart) continue;
      comparisons++;
      if (b.operatingProfit >= a.operatingProfit) failures.push(`${difficulties[i + 1]} beats ${difficulties[i]} on profit: ${r}/${sc}`);
      if (b.endCash >= a.endCash) failures.push(`${difficulties[i + 1]} beats ${difficulties[i]} on cash: ${r}/${sc}`);
    }
  }

  // 3. Loss tolerance must fall as difficulty rises.
  const tolerance = {};
  for (const d of difficulties) {
    const cash0 = config.opening[d].cash; let worst = 0;
    for (const r of routeIds) {
      const row = go(r, 'baseline', d);
      if (row.gatedAtStart) continue;
      let prev = cash0;
      for (const m of row.months) { const delta = m.endCash - prev; prev = m.endCash; if (delta < worst) worst = delta; }
    }
    tolerance[d] = Number((cash0 / Math.abs(worst || 1)).toFixed(2));
  }
  if (!(tolerance.easy > tolerance.normal)) failures.push(`loss tolerance: easy ${tolerance.easy} is not above normal ${tolerance.normal}`);
  if (!(tolerance.normal > tolerance.hard)) failures.push(`loss tolerance: normal ${tolerance.normal} is not above hard ${tolerance.hard}`);

  // 4. Every investment must still pay back inside six months.
  const investments = {};
  const prune = list => {
    let out = [...list];
    for (;;) {
      const benches = config.opening.normal.benches + out.reduce((n, p) => n + (config.investments[p.id].addedBenches || 0), 0);
      const bad = out.filter(p => config.investments[p.id].requiresBenches > benches);
      if (!bad.length) return out;
      out = out.filter(p => !bad.includes(p));
    }
  };
  for (const r of routeIds) {
    const route = routes[r];
    const base = go(r, 'baseline', 'normal');
    for (const p of route.investments) {
      const kept = prune(route.investments.filter(x => x.id !== p.id));
      if (kept.length === route.investments.length) continue;
      const variant = simulate(r, 'baseline', 'normal', { products, monthlyProductionTargets: route.monthlyProductionTargets,
        investments: kept, hires: route.hires, reputationGrowsPool: PROPOSAL.reputationGrowsPool });
      const removed = route.investments.filter(x => !kept.includes(x)).map(x => x.id);
      const cost = removed.reduce((n, id) => n + config.investments[id].cost +
        (config.investments[id].additionalMonthlyUtilities || 0) * 6, 0);
      const marginal = base.operatingProfit - variant.operatingProfit;
      investments[`${r}|${p.id}`] = { marginal: Math.round(marginal), cost, payback: Number((marginal / cost).toFixed(2)) };
      if (marginal / cost < 1) failures.push(`${r}/${p.id} pays back ${(marginal / cost).toFixed(2)}`);
    }
  }

  // 5. Section 7.3 wants a late investment on more than one route.
  const late = routeIds.filter(r => routes[r].investments.some(p => p.month >= 5));
  if (late.length < 2) failures.push(`only ${late.join(', ')} has a month 5-6 investment`);

  // 6. The fifteen years must stay playable.
  const era = read('era-trends.json');
  const fullGame = era.years.map(y => {
    const row = simulate('mixed', 'baseline', 'normal', {
      products, monthlyProductionTargets: routes.mixed.monthlyProductionTargets,
      investments: routes.mixed.investments, hires: routes.mixed.hires,
      reputationGrowsPool: PROPOSAL.reputationGrowsPool,
      scenario: { demandMultiplier: y.demandIndex, partsPriceMultiplier: y.partsCostIndex, priceIndex: y.priceIndex },
    });
    if (row.operatingProfit <= 0) failures.push(`${y.year}: the mixed route loses money`);
    return { year: y.year, profit: Math.round(row.operatingProfit) };
  });

  const output = {
    status: failures.length ? 'failed' : 'passed',
    failures,
    baseline,
    lossToleranceMonths: tolerance,
    difficultyComparisons: comparisons,
    investments,
    routesWithLateInvestment: late,
    fullGameProfit: { first: fullGame[0], last: fullGame.at(-1), min: Math.min(...fullGame.map(f => f.profit)), max: Math.max(...fullGame.map(f => f.profit)) },
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'proposal-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run, PROPOSAL };
