// Quantify how much each balance lever actually moves profit, per route.
const fs = require('node:fs');
const path = require('node:path');
const { simulate, config, channels } = require('./simulate-economy.cjs');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

const DIFFICULTY = 'normal', SCENARIO = 'baseline', STEP = 0.10;
const routes = Object.keys(config.routes).filter(r => config.opening[DIFFICULTY].startingRoutes.includes(r));

const scale = (obj, key, f) => Object.fromEntries(Object.entries(obj).map(([k, v]) =>
  [k, typeof v === 'object' && v !== null && !Array.isArray(v) ? { ...v, [key]: v[key] * f } : v]));
const scaleAllProducts = (f, keys) => {
  const p = JSON.parse(JSON.stringify(config.products));
  for (const id of Object.keys(p)) for (const k of keys) p[id][k] = Math.round(p[id][k] * f * 100) / 100;
  return p;
};
const scaleCaps = f => Object.fromEntries(Object.entries(config.companyDemandCaps)
  .map(([id, arr]) => [id, arr.map(v => Math.max(0, Math.round(v * f))) ]));

// Each lever is expressed as an override factory so the real simulator does the work.
const LEVERS = [
  { id: 'salePrice', zh: '售价', apply: f => ({ products: scaleAllProducts(f, ['salePrice']) }) },
  { id: 'demandCaps', zh: '客群上限', apply: f => ({ demandCaps: scaleCaps(f) }) },
  { id: 'partsCost', zh: '配件成本', apply: f => ({ scenario: { demandMultiplier: 1, partsPriceMultiplier: f } }) },
  // Perturb the depth of the discount, not the price level: scaling the factor itself would be
  // mathematically identical to the parts-cost lever.
  { id: 'channelDepth', zh: '渠道折扣深度', apply: (f, routeId) => {
      const base = channels.get(config.routes[routeId].partsChannel).nominalUnitPriceFactor;
      return { channelFactor: 1 - (1 - base) * f };
    } },
  { id: 'designHours', zh: '设计工时', apply: f => ({ products: scaleAllProducts(f, ['designHours']) }) },
  { id: 'assemblyHours', zh: '装配工时', apply: f => ({ products: scaleAllProducts(f, ['assemblyHours']) }) },
  { id: 'salary', zh: '员工工资', apply: f => ({ employee: { monthlySalary: config.employee.monthlySalary * f } }) },
  { id: 'rent', zh: '租金', apply: f => ({ opening: { rent: config.opening[DIFFICULTY].rent * f } }) },
];

function run() {
  const base = Object.fromEntries(routes.map(r => [r, simulate(r, SCENARIO, DIFFICULTY).operatingProfit]));
  const rows = [];
  for (const lever of LEVERS) {
    const up = {}, down = {};
    for (const r of routes) {
      up[r] = simulate(r, SCENARIO, DIFFICULTY, lever.apply(1 + STEP, r)).operatingProfit;
      down[r] = simulate(r, SCENARIO, DIFFICULTY, lever.apply(1 - STEP, r)).operatingProfit;
    }
    const entry = { lever: lever.id, zh: lever.zh, routes: {} };
    for (const r of routes) {
      const swing = up[r] - down[r];
      // Elasticity: percent change in profit for a one percent change in the lever.
      entry.routes[r] = {
        baseline: Number(base[r].toFixed(2)),
        plus10: Number(up[r].toFixed(2)),
        minus10: Number(down[r].toFixed(2)),
        swing: Number(swing.toFixed(2)),
        elasticity: Number((((up[r] - down[r]) / 2) / base[r] / STEP).toFixed(3)),
      };
    }
    entry.averageSwing = Number((routes.reduce((n, r) => n + Math.abs(entry.routes[r].swing), 0) / routes.length).toFixed(2));
    rows.push(entry);
  }
  rows.sort((a, b) => b.averageSwing - a.averageSwing);

  const output = {
    status: 'informational',
    difficulty: DIFFICULTY, scenario: SCENARIO, step: STEP,
    baseline: base,
    note: 'Elasticity is the percent change in six-month operating profit for a one percent change in the lever. A lever can only matter where the route is not already pinned by something else.',
    levers: rows,
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'sensitivity.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
