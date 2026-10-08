// Run the route model across all fifteen confirmed years using the era pacing indices.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { simulate, config } = require('./simulate-economy.cjs');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

const era = read('era-trends.json');
const { DIFFICULTY } = require('./demo-facts.cjs');

function run() {
  const routes = Object.keys(config.routes).filter(r => config.opening[DIFFICULTY].startingRoutes.includes(r));
  const years = [];
  for (const year of era.years) {
    // The era indices scale the two things the six-month model already understands.
    const scenario = {
      demandMultiplier: year.demandIndex,
      partsPriceMultiplier: year.partsCostIndex,
      priceIndex: year.priceIndex,
    };
    const perRoute = {};
    for (const route of routes) {
      const r = simulate(route, 'baseline', DIFFICULTY, { scenario });
      perRoute[route] = {
        profit: r.operatingProfit, endCash: r.endCash, inventory: r.inventoryCost,
        bankrupt: r.bankrupt, sales: r.totalSales,
      };
    }
    const profits = routes.map(r => perRoute[r].profit);
    years.push({
      year: year.year, basis: year.basis, era: year.era,
      demandIndex: year.demandIndex, partsCostIndex: year.partsCostIndex,
      routes: perRoute,
      bestRoute: routes[profits.indexOf(Math.max(...profits))],
      worstRoute: routes[profits.indexOf(Math.min(...profits))],
      allProfitable: profits.every(p => p > 0),
      anyBankrupt: routes.some(r => perRoute[r].bankrupt),
    });
  }

  // The fifteen years must stay playable: no year may wipe out every route.
  for (const y of years) {
    assert(y.allProfitable,
      `${y.year}: every route loses money (demand ${y.demandIndex}, cost ${y.partsCostIndex})`);
    assert(!y.anyBankrupt, `${y.year}: a route goes bankrupt`);
  }

  // The cycle has to actually turn, otherwise the era model does nothing.
  const demands = years.map(y => y.demandIndex);
  assert(Math.max(...demands) - Math.min(...demands) >= 0.25,
    'the demand cycle is too flat to change how the game plays');
  assert(demands.indexOf(Math.max(...demands)) < demands.indexOf(Math.min(...demands)),
    'the boom must arrive before the trough for the cycle to read as a cycle');

  const output = {
    status: 'passed',
    difficulty: DIFFICULTY,
    years: years.length,
    window: `${years[0].year}-${years.at(-1).year}`,
    peakYear: years[demands.indexOf(Math.max(...demands))].year,
    troughYear: years[demands.indexOf(Math.min(...demands))].year,
    trajectory: years.map(y => ({
      year: y.year, basis: y.basis,
      demandIndex: y.demandIndex, partsCostIndex: y.partsCostIndex,
      priceIndex: era.years.find(e => e.year === y.year)?.priceIndex,
      boutique: y.routes.boutique?.profit, scale: y.routes.scale?.profit, mixed: y.routes.mixed?.profit,
      bestRoute: y.bestRoute,
    })),
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'fullgame-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
