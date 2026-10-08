// Freeze the calibrated balance into a baseline so later changes can be diffed against it.
const fs = require('node:fs');
const path = require('node:path');
const { simulate, config, failureRateFor } = require('./simulate-economy.cjs');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));
const BASELINE = path.join(root, 'design', 'balance-baseline.json');

const round2 = v => Number(v.toFixed(2));

// Everything a rebalance could move, gathered in one place.
function snapshot() {
  const era = read('era-trends.json');
  const routes = Object.keys(config.routes);
  const scenarios = Object.keys(config.scenarios);
  const difficulties = Object.keys(config.opening);

  const runs = {};
  for (const difficulty of difficulties)
    for (const scenario of scenarios)
      for (const route of routes) {
        const r = simulate(route, scenario, difficulty);
        runs[`${difficulty}|${scenario}|${route}`] = {
          profit: round2(r.operatingProfit), endCash: round2(r.endCash),
          bankrupt: r.bankrupt, bankruptMonth: r.bankruptMonth,
          gatedAtStart: r.gatedAtStart, sales: r.totalSales,
        };
      }

  const lossTolerance = {};
  for (const difficulty of difficulties) {
    const cash0 = config.opening[difficulty].cash;
    let worst = 0;
    for (const route of routes) {
      const row = runs[`${difficulty}|baseline|${route}`];
      if (row.gatedAtStart) continue;
      let prev = cash0;
      for (const m of simulate(route, 'baseline', difficulty).months) {
        const delta = m.endCash - prev; prev = m.endCash; if (delta < worst) worst = delta;
      }
    }
    lossTolerance[difficulty] = { worstMonth: Math.round(worst), months: Number((cash0 / Math.abs(worst || 1)).toFixed(2)) };
  }

  // Dropping a bench also drops equipment that needs two of them, as check:investments does.
  const prune = list => {
    let out = [...list];
    for (;;) {
      const benches = config.opening.normal.benches + out.reduce((n, p) => n + (config.investments[p.id].addedBenches || 0), 0);
      const bad = out.filter(p => config.investments[p.id].requiresBenches > benches);
      if (!bad.length) return out;
      out = out.filter(p => !bad.includes(p));
    }
  };
  const investments = {};
  for (const [routeId, route] of Object.entries(config.routes)) {
    const base = runs[`normal|baseline|${routeId}`];
    for (const p of route.investments) {
      const kept = prune(route.investments.filter(x => x.id !== p.id));
      if (kept.length === route.investments.length) continue;
      const variant = simulate(routeId, 'baseline', 'normal', { investments: kept });
      investments[`${routeId}|${p.id}`] = round2(base.profit - variant.operatingProfit);
    }
  }

  const reliability = Object.fromEntries(
    read('balance.json').recipes.map(r => [r.id, Number(failureRateFor(r).toFixed(4))]));

  const fullGame = Object.fromEntries(era.years.map(y => [y.year, round2(
    simulate('mixed', 'baseline', 'normal', {
      scenario: { demandMultiplier: y.demandIndex, partsPriceMultiplier: y.partsCostIndex, priceIndex: y.priceIndex },
    }).operatingProfit)]));

  return {
    note: 'Frozen balance metrics. Run npm run baseline:diff after a change, and npm run baseline:update to accept the new numbers.',
    runs, lossTolerance, investments, reliability, fullGame,
  };
}

// Compare two snapshots, returning every leaf that moved.
function walk(a, b, prefix, out) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) {
    const path = prefix ? `${prefix}.${k}` : k;
    const av = a?.[k], bv = b?.[k];
    if (av && bv && typeof av === 'object' && typeof bv === 'object') { walk(av, bv, path, out); continue; }
    if (av !== bv) out.push({ key: path, before: av ?? null, after: bv ?? null });
  }
  return out;
}

function diff() {
  if (!fs.existsSync(BASELINE)) { console.log('No baseline yet. Run: npm run baseline:update'); return { status: 'missing', changes: [] }; }
  const before = read('balance-baseline.json');
  const after = snapshot();
  const changes = walk(before.runs, after.runs, 'runs', []);
  walk(before.lossTolerance, after.lossTolerance, 'lossTolerance', changes);
  walk(before.investments, after.investments, 'investments', changes);
  walk(before.reliability, after.reliability, 'reliability', changes);
  walk(before.fullGame, after.fullGame, 'fullGame', changes);

  const output = { status: changes.length ? 'drifted' : 'unchanged', changes: changes.length, detail: changes };
  console.log(JSON.stringify(output, null, 2));
  return output;
}

function update() {
  const snap = snapshot();
  fs.writeFileSync(BASELINE, JSON.stringify(snap, null, 2) + '\n');
  console.log('baseline written:', Object.keys(snap.runs).length, 'runs,', Object.keys(snap.fullGame).length, 'years');
  return snap;
}

const cmd = process.argv[2];
if (require.main === module) {
  if (cmd === 'update') update();
  else diff();
}
module.exports = { snapshot, diff, update };
