// The product evaluation must cover the six dimensions spec section 6.2 requires.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { evaluateDimensions, finish } = require('./evaluate-product.cjs');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

const evaluation = read('evaluation.json');
const balance = read('balance.json');
// The spec names these six; the ids are the model's own.
const REQUIRED = { useCase: '用途', performance: '性能', thermals: '温度', noise: '噪声', appearance: '外观', cost: '成本' };
const TARGET = { office: 'office', gaming: 'gaming', quiet_office: 'office', premium: 'creation' };

function run() {
  assert.equal(evaluation.schemaVersion, 1, 'schema');
  assert(evaluation.status && evaluation.provenance?.existing && evaluation.provenance?.new && evaluation.provenance?.limits, 'provenance');

  // Coverage: every dimension the spec names must exist, and nothing extra may stand in for one.
  const ids = evaluation.dimensions.map(d => d.id);
  for (const [id, zh] of Object.entries(REQUIRED)) {
    assert(ids.includes(id), `the evaluation is missing the ${zh} dimension`);
    const d = evaluation.dimensions.find(x => x.id === id);
    assert(d.zh === zh, `dimension ${id} is labelled ${d.zh}, the spec calls it ${zh}`);
    assert(['higher', 'lower'].includes(d.direction), `${id}: direction`);
    assert(d.source && d.note, `${id}: source and note`);
  }
  assert.equal(new Set(ids).size, ids.length, 'duplicate dimension id');
  assert.deepEqual([...evaluation.scoreRange], [0, 100], 'scores are 0-100');

  // Every recipe must score on every dimension, at every finish level.
  const rows = [];
  for (const recipe of balance.recipes) {
    for (const level of finish.levels) {
      const out = evaluateDimensions(recipe, { targetUseCase: TARGET[recipe.id], finishLevelId: level.id });
      for (const id of ids) {
        const v = out.scores[id];
        assert(Number.isFinite(v), `${recipe.id}/${level.id}: ${id} is not a number`);
        assert(v >= 0 && v <= 100, `${recipe.id}/${level.id}: ${id} scored ${v}, outside 0-100`);
      }
      rows.push({ recipe: recipe.id, finish: level.id, ...out.rounded });
    }
  }

  // Appearance must rise with the finish level, and so must its price in money and time.
  const ordered = [...finish.levels].sort((a, b) => a.appearancePoints - b.appearancePoints);
  for (let i = 1; i < ordered.length; i++) {
    assert(ordered[i].additionalConsumablesCoins >= ordered[i - 1].additionalConsumablesCoins,
      `${ordered[i].id}: a better finish may not be cheaper than ${ordered[i - 1].id}`);
    assert(ordered[i].additionalLaborHours >= ordered[i - 1].additionalLaborHours,
      `${ordered[i].id}: a better finish may not take less time than ${ordered[i - 1].id}`);
  }
  assert(ordered[0].additionalConsumablesCoins === 0 && ordered[0].additionalLaborHours === 0,
    'the standard finish must be free, or a new workshop cannot ship anything');

  // Directions must actually hold: a quieter build scores higher on noise, a cheaper one on cost.
  const byNoise = [...balance.recipes].sort((a, b) =>
    evaluateDimensions(a, { targetUseCase: TARGET[a.id] }).report.noiseBurden -
    evaluateDimensions(b, { targetUseCase: TARGET[b.id] }).report.noiseBurden);
  const quietest = evaluateDimensions(byNoise[0], { targetUseCase: TARGET[byNoise[0].id] }).scores.noise;
  const loudest = evaluateDimensions(byNoise.at(-1), { targetUseCase: TARGET[byNoise.at(-1).id] }).scores.noise;
  assert(quietest > loudest, `noise runs the wrong way: the quietest build scores ${quietest} against the loudest ${loudest}`);

  // Cost is the customer's view: how much of their budget the machine consumes, not its absolute price.
  const use = r => r.expectedPartsCost / r.budgetCoins[1];
  const byCost = [...balance.recipes].sort((a, b) => use(a) - use(b));
  const cheapest = evaluateDimensions(byCost[0], { targetUseCase: TARGET[byCost[0].id] }).scores.cost;
  const dearest = evaluateDimensions(byCost.at(-1), { targetUseCase: TARGET[byCost.at(-1).id] }).scores.cost;
  assert(cheapest > dearest,
    `cost runs the wrong way: the build using ${(use(byCost[0]) * 100).toFixed(0)} percent of budget scores ${cheapest} against ${(use(byCost.at(-1)) * 100).toFixed(0)} percent scoring ${dearest}`);

  // Performance and appearance must not depend on the target use case.
  const recipe = balance.recipes[0];
  const asOffice = evaluateDimensions(recipe, { targetUseCase: 'office' });
  const asGaming = evaluateDimensions(recipe, { targetUseCase: 'gaming' });
  assert.equal(asOffice.scores.performance, asGaming.scores.performance, 'performance must not depend on the target use case');
  assert.equal(asOffice.scores.appearance, asGaming.scores.appearance, 'appearance must not depend on the target use case');
  assert.notEqual(asOffice.scores.useCase, asGaming.scores.useCase, 'use-case fit must depend on the target use case');

  const output = {
    status: 'passed',
    dimensions: ids.length,
    required: Object.values(REQUIRED),
    finishLevels: finish.levels.length,
    rows,
    directionChecks: {
      noiseQuietestVsLoudest: [Math.round(quietest * 10) / 10, Math.round(loudest * 10) / 10],
      costCheapestVsDearest: [Math.round(cheapest * 10) / 10, Math.round(dearest * 10) / 10],
    },
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'evaluation-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify({ ...output, rows: output.rows.slice(0, 4) }, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
