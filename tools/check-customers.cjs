// Prove the customer model is derived from, and stays consistent with, the confirmed recipes.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { evaluate } = require('./check-design.cjs');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

const model = read('customer-model.json');
const balance = read('balance.json');
const catalog = read('components.json');
const economy = read('economy-candidate.json');
const byPart = new Map(catalog.parts.map(p => [p.id, p]));
const recipes = new Map(balance.recipes.map(r => [r.id, r]));

// Budget is part of eligibility: a customer who cannot afford a build never orders it, which is
// what keeps each archetype pointed at one recipe even when several clear its hard gates.
function affordable(recipe, archetype) {
  return recipe.expectedPartsCost + recipe.directCostCoins <= archetype.budgetCoins[1];
}
function eligible(recipe, archetype) {
  return affordable(recipe, archetype) && satisfies(recipe, archetype.requirements);
}
// A requirement set is satisfied only when every hard gate passes; scores never compensate.
function satisfies(recipe, req) {
  const report = evaluate(recipe);
  if (report.blocked.length) return false;
  if (req.minimumRamGB !== null && report.ramGB < req.minimumRamGB) return false;
  if (req.maximumNoiseBurden !== null && report.noiseBurden > req.maximumNoiseBurden) return false;
  if (req.requiredDiscreteGpu && !recipe.gpu) return false;
  if (req.minimumVramGB !== null) {
    if (!recipe.gpu) return false;
    if (byPart.get(recipe.gpu).game.vramGB < req.minimumVramGB) return false;
  }
  if (req.minimumStorageGB !== null) {
    const total = recipe.storage.reduce((n, s) => n + byPart.get(s.id).game.capacityGB * s.quantity, 0);
    if (total < req.minimumStorageGB) return false;
  }
  for (const [use, minimum] of Object.entries(req.minimumScores)) if (report.scores[use] < minimum) return false;
  return true;
}

function run() {
  assert.equal(model.schemaVersion, 1, 'schema');
  assert(model.status && model.provenance?.existing && model.provenance?.new, 'provenance');
  assert.equal(new Set(model.archetypes.map(a => a.id)).size, model.archetypes.length, 'duplicate archetype id');

  const segmentProducts = {};
  for (const [id, seg] of Object.entries(model.segments)) {
    assert(seg.zh && Array.isArray(seg.products) && seg.products.length, `segment ${id}`);
    for (const p of seg.products) assert(Object.hasOwn(economy.products, p), `segment ${id}: unknown product ${p}`);
    segmentProducts[id] = seg.products;
  }

  const rows = [];
  for (const a of model.archetypes) {
    const recipe = recipes.get(a.referenceRecipe);
    assert(recipe, `${a.id}: unknown reference recipe`);
    assert(segmentProducts[a.segment].includes(a.referenceRecipe), `${a.id}: reference recipe outside its segment`);
    assert(Number.isFinite(a.weight) && a.weight > 0, `${a.id}: weight`);
    assert(a.budgetCoins.length === 2 && a.budgetCoins[0] < a.budgetCoins[1], `${a.id}: budget range`);

    // The reference build must clear every gate and fit the budget.
    assert(eligible(recipe, a), `${a.id}: reference recipe ${a.referenceRecipe} is not eligible`);

    // And it must be the only eligible build, otherwise the archetype has no teeth.
    const others = balance.recipes.filter(r => r.id !== a.referenceRecipe && eligible(r, a)).map(r => r.id);
    assert.deepEqual(others, [], `${a.id}: also eligible ${others.join(', ')}`);

    // The customer must be able to afford the reference build.
    const direct = recipe.expectedPartsCost + recipe.directCostCoins;
    assert(direct <= a.budgetCoins[0], `${a.id}: reference cost ${direct} exceeds the budget floor ${a.budgetCoins[0]}`);

    // The archetype budget must sit inside the recipe's own agreed budget example.
    assert(a.budgetCoins[0] >= recipe.budgetCoins[0] && a.budgetCoins[1] <= recipe.budgetCoins[1],
      `${a.id}: budget ${a.budgetCoins} outside recipe budget ${recipe.budgetCoins}`);

    // Fit is measured against the reference build, so F is exactly 1 for it.
    const report = evaluate(recipe);
    assert.equal(a.fitUseCase, model.archetypes.find(x => x.id === a.id).fitUseCase, `${a.id}: fit use case`);
    assert(Object.hasOwn(report.scores, a.fitUseCase), `${a.id}: unknown fit use case ${a.fitUseCase}`);
    assert(Math.abs(report.scores[a.fitUseCase] - a.expectedScore) < 0.01,
      `${a.id}: expectedScore ${a.expectedScore} does not match the reference score ${report.scores[a.fitUseCase]}`);

    rows.push({ archetype: a.id, recipe: a.referenceRecipe, weight: a.weight, budget: a.budgetCoins, direct, noise: report.noiseBurden, ramGB: report.ramGB });
  }

  // Archetype weights must reproduce the product split that the demand caps already assume.
  const capTotals = Object.fromEntries(Object.keys(economy.products).map(id =>
    [id, economy.companyDemandCaps[id].reduce((a, b) => a + b, 0)]));
  const ratios = [];
  for (const [segId, products] of Object.entries(segmentProducts)) {
    const members = model.archetypes.filter(a => a.segment === segId);
    const totalWeight = members.reduce((n, a) => n + a.weight, 0);
    const capSum = products.reduce((n, p) => n + capTotals[p], 0);
    for (const p of products) {
      const modelShare = members.filter(a => a.referenceRecipe === p).reduce((n, a) => n + a.weight, 0) / totalWeight;
      const capShare = capTotals[p] / capSum;
      assert(Math.abs(modelShare - capShare) <= 0.05,
        `${segId}/${p}: archetype share ${modelShare.toFixed(3)} differs from the demand-cap share ${capShare.toFixed(3)}`);
      ratios.push({ segment: segId, product: p, archetypeShare: Number(modelShare.toFixed(4)), demandCapShare: Number(capShare.toFixed(4)) });
    }
  }

  // Pricing must be a real decision. If raising the price above the market reference always
  // increased contribution, the only correct play would be to max the price.
  const pricing = [];
  for (const a of model.archetypes) {
    const recipe = recipes.get(a.referenceRecipe);
    const reference = (a.budgetCoins[0] + a.budgetCoins[1]) / 2;
    const direct = recipe.expectedPartsCost + recipe.directCostCoins;
    const above = model.priceAcceptance.aboveSlopeBySegment[a.segment];
    assert(Number.isFinite(above) && above > 0, `${a.id}: missing price slope for ${a.segment}`);
    const contribution = price => {
      const ratio = price / reference;
      const p = ratio <= 1
        ? Math.min(model.priceAcceptance.ceiling, 1 + model.priceAcceptance.belowSlope * (1 - ratio))
        : Math.max(model.priceAcceptance.floor, 1 - above * (ratio - 1));
      return (price - direct) * p;
    };
    const atReference = contribution(reference);
    let best = atReference, bestRatio = 1;
    for (let ratio = 1.01; ratio <= 1.6; ratio += 0.01) {
      const price = reference * ratio;
      if (price > a.budgetCoins[1]) break;
      const value = contribution(price);
      if (value > best) { best = value; bestRatio = ratio; }
    }
    assert(best <= atReference + 1e-6,
      `${a.id}: pricing ${((bestRatio - 1) * 100).toFixed(0)}% above market raises contribution from ${atReference.toFixed(1)} to ${best.toFixed(1)}`);
    pricing.push({ archetype: a.id, segment: a.segment, reference, atReference: Math.round(atReference), bestAboveMarketRatio: Number(bestRatio.toFixed(3)) });
  }

  const rep = model.reputation;
  assert(rep.floor < rep.initial && rep.initial < rep.ceiling, 'reputation bounds');
  assert(rep.onTimeMeetingRequirements > 0 && rep.deliveredMissingRequirement < 0 && rep.lateMeetingRequirements < 0, 'reputation deltas');
  assert(model.priceAcceptance.floor < 1 && model.priceAcceptance.ceiling > 1, 'price acceptance clamp');
  assert(model.fit.formula.includes('clamp'), 'fit rule');

  const output = {
    status: 'passed',
    archetypes: model.archetypes.length,
    segments: Object.keys(model.segments).length,
    massWeight: model.archetypes.filter(a => a.segment === 'mass').reduce((n, a) => n + a.weight, 0),
    bespokeWeight: model.archetypes.filter(a => a.segment === 'bespoke').reduce((n, a) => n + a.weight, 0),
    demandCapTotals: capTotals,
    ratios, rows, pricing,
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'customer-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run, satisfies, eligible, affordable };
