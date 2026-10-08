// Seams between models: a score nothing consumes, or a cost nothing charges, is dead weight.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { evaluateDimensions } = require('./evaluate-product.cjs');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

const evaluation = read('evaluation.json');
const customers = read('customer-model.json');
const finish = read('finish-options.json');
const caseOptions = read('case-options.json');
const balance = read('balance.json');
const simulator = fs.readFileSync(path.join(root, 'tools', 'simulate-economy.cjs'), 'utf8');

function run() {
  // 1. A dimension that no decision reads is a number nobody acts on.
  const customerJson = JSON.stringify(customers);
  const consumedBy = {
    useCase: customerJson.includes('minimumScores'),
    noise: customerJson.includes('maximumNoiseBurden'),
    appearance: customerJson.includes('appearancePreference'),
    cost: customerJson.includes('budgetCoins'),
  };
  const dead = [], declared = [];
  for (const dim of evaluation.dimensions) {
    if (consumedBy[dim.id]) continue;
    // A dimension nobody acts on is allowed only if the model says so out loud.
    if (dim.informational) { declared.push(dim.id); continue; }
    dead.push(dim.id);
  }
  assert.equal(dead.length, 0, dead.length + " evaluation dimensions are scored but neither read by a customer decision nor declared informational: " + dead.join(", "));
  // 2. Every cost a model defines has to be charged, or the model is decorative.
  const charged = [];
  if (!simulator.includes('appearance[id].cost')) charged.push('finish and case option costs');
  if (!simulator.includes('reliability.rework.consumablesCoins')) charged.push('rework consumables');
  if (!simulator.includes('investment.cost')) charged.push('investment cost');
  if (!simulator.includes('developmentCost')) charged.push('development cost');
  assert.equal(charged.length, 0, `these costs are defined but never charged: ${charged.join(', ')}`);
  // And the appearance hours have to reach the capacity model too.
  assert(simulator.includes('appearance[id].hours'), 'finish labour is defined but never charged to capacity');

  // 3. Scores must stay inside the declared range even at the richest build.
  const everyOption = Object.fromEntries(caseOptions.groups.map(g => {
    const richest = [...g.options].sort((a, b) => b.appearancePoints - a.appearancePoints || b.coolingMultiplier - a.coolingMultiplier)[0];
    return [g.id, richest.id];
  }));
  const richestFinish = [...finish.levels].sort((a, b) => b.appearancePoints - a.appearancePoints)[0];
  const [lo, hi] = evaluation.scoreRange;
  const extremes = [];
  for (const recipe of balance.recipes) {
    for (const level of finish.levels) {
      for (const opts of [{}, everyOption]) {
        const out = evaluateDimensions(recipe, { targetUseCase: 'office', finishLevelId: level.id, caseOptions: opts });
        for (const dim of evaluation.dimensions) {
          const v = out.scores[dim.id];
          assert(Number.isFinite(v) && v >= lo && v <= hi,
            `${recipe.id}/${level.id}: ${dim.id} scored ${v} with the richest options, outside ${lo}-${hi}`);
        }
        if (level.id === richestFinish.id && Object.keys(opts).length) {
          extremes.push({ recipe: recipe.id, appearance: out.rounded.appearance, cost: out.finishLevel.additionalConsumablesCoins + out.caseOptionCost });
        }
      }
    }
  }

  // 4. Appearance must change the money, not only a score.
  const plain = evaluateDimensions(balance.recipes[0], { targetUseCase: 'office' });
  const dressed = evaluateDimensions(balance.recipes[0], { targetUseCase: 'office', finishLevelId: richestFinish.id, caseOptions: everyOption });
  assert(dressed.scores.appearance > plain.scores.appearance, 'the richest build does not look better than the plain one');
  assert(dressed.finishLevel.additionalConsumablesCoins + dressed.caseOptionCost > 0, 'the richest build is free');

  const output = {
    status: 'passed',
    dimensionsConsumed: evaluation.dimensions.filter(d => consumedBy[d.id]).map(d => d.id),
    dimensionsDeclaredInformational: declared,
    costsCharged: ['finish and case options', 'rework consumables', 'investment cost', 'development cost'],
    richestBuildPerRecipe: extremes,
    appearancePremiumCap: customers.appearancePreference.maxPricePremium,
    note: '外观分既抬价也抬预算上限，所以同一个价格在接受度不变的前提下多收一笔',
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'seam-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
