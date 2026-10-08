// Validate the reliability model and prove rework actually costs money and capacity.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { evaluate } = require('./check-design.cjs');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

const model = read('reliability-model.json');
const balance = read('balance.json');

function failureRateFor(recipe) {
  const report = evaluate(recipe);
  const r = model.failureRate;
  let rate = r.base;
  if (!report.thermalStable) rate *= r.conditionMultipliers.thermallyUnstable;
  if (report.powerHeadroom < r.conditionMultipliers.powerHeadroomThreshold) rate *= r.conditionMultipliers.powerHeadroomBelowThreshold;
  if (report.deliveryIssues.includes('TEST_UNSTABLE')) rate *= r.conditionMultipliers.deliveryIssueUnstable;
  return Math.min(r.ceiling, rate);
}
function expectedCost(recipe) {
  const rate = failureRateFor(recipe);
  return rate * (model.rework.consumablesCoins + model.rework.partReplacementChance * recipe.expectedPartsCost);
}
function expectedHours(recipe) {
  const rate = failureRateFor(recipe);
  return { labor: rate * model.rework.laborHours, test: rate * model.rework.testStationHours };
}

function run() {
  assert.equal(model.schemaVersion, 1, 'schema');
  assert(model.status && model.provenance?.existing && model.provenance?.new && model.provenance?.limits, 'provenance');
  assert(model.rules?.neverBrandReputation, 'failure must never key off a brand name');
  assert(model.rules?.caughtByTesting, 'testing must decide whether a failure is caught');

  const r = model.failureRate;
  assert(r.base > 0 && r.base < 1, 'base failure rate must be a probability');
  assert(r.ceiling >= r.base && r.ceiling <= 1, 'ceiling must bound the base rate');
  for (const [k, v] of Object.entries(r.conditionMultipliers)) {
    if (k === 'powerHeadroomThreshold') assert(v > 0 && v < 1, 'headroom threshold is a ratio');
    else assert(v >= 1, `condition multiplier ${k} must not reward a worse build`);
  }

  const rw = model.rework;
  // The recorded candidate was 2-4 labour hours, 1-2 test hours and 40-100 consumables.
  assert(rw.laborHours >= 2 && rw.laborHours <= 4, `rework labour ${rw.laborHours} outside the recorded candidate range`);
  assert(rw.testStationHours >= 1 && rw.testStationHours <= 2, `rework test hours ${rw.testStationHours} outside the recorded candidate range`);
  assert(rw.consumablesCoins >= 40 && rw.consumablesCoins <= 100, `rework consumables ${rw.consumablesCoins} outside the recorded candidate range`);
  assert(rw.partReplacementChance >= 0 && rw.partReplacementChance <= 1, 'replacement chance must be a probability');

  const qc = model.qualityControl;
  assert(qc.escapeRateWithoutTesting > qc.escapeRateWithMinimalTesting, 'skipping the test must let more defects through');
  assert(qc.escapeRateWithoutTesting <= 1 && qc.escapeRateWithMinimalTesting >= 0, 'escape rates are probabilities');

  const ad = model.arrivalDefect;
  assert(ad.refundFraction > 0 && ad.refundFraction <= 1, 'refund fraction');
  assert(ad.reputationDelta < 0, 'an arrival defect must cost reputation');

  const recipes = [];
  for (const recipe of balance.recipes) {
    const report = evaluate(recipe);
    recipes.push({
      recipe: recipe.id, failureRate: Number(failureRateFor(recipe).toFixed(4)),
      thermalStable: report.thermalStable, powerHeadroom: report.powerHeadroom,
      reworkCoins: Number(expectedCost(recipe).toFixed(1)), reworkHours: expectedHours(recipe),
    });
  }

  // The reference builds are well designed, so they must sit at the base rate.
  for (const row of recipes) assert.equal(row.failureRate, r.base, `${row.recipe}: a sound build must sit at the base rate`);

  // A build the balance model already flags must cost materially more, or the mechanic is inert.
  const good = balance.recipes.find(x => x.id === 'premium');
  const bad = { ...good, fanProfile: 'quiet' };
  const badReport = evaluate(bad);
  assert.equal(badReport.thermalStable, false, 'the quiet fan profile must remain thermally unstable for this check');
  const goodRate = failureRateFor(good), badRate = failureRateFor(bad);
  assert(badRate >= goodRate * 3, `a thermally unstable build only reaches ${badRate.toFixed(3)} against ${goodRate.toFixed(3)}`);

  // Rework must move the six-month result, otherwise "repeated rework erodes profit" is not true in game.
  const results = read('economy-review-results.json').results;
  const impact = [];
  for (const route of Object.keys(read('economy-candidate.json').routes)) {
    const row = results.find(x => x.difficulty === 'normal' && x.route === route && x.scenario === 'baseline');
    const rework = row.months.reduce((n, m) => n + m.reworkCost, 0);
    const share = rework / (row.operatingProfit + rework);
    assert(share > 0.01, `${route}: rework is only ${(share * 100).toFixed(2)} percent of cost, too small to matter`);
    impact.push({ route, reworkCoins: Math.round(rework), shareOfCostPercent: Number((share * 100).toFixed(1)) });
  }

  const output = {
    status: 'passed',
    baseFailureRate: r.base,
    ceiling: r.ceiling,
    wellDesignedFailureRate: goodRate,
    thermallyUnstableFailureRate: Number(badRate.toFixed(4)),
    recipes, impact,
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'reliability-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run, failureRateFor, expectedCost };
