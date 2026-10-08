// Turn the existing balance numbers into the six evaluation dimensions spec section 6.2 requires.
const fs = require('node:fs');
const path = require('node:path');
const { evaluate } = require('./check-design.cjs');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

const evaluation = read('evaluation.json');
const finish = read('finish-options.json');
const caseOptions = read('case-options.json');
const balance = read('balance.json');
const clamp01 = v => Math.min(1, Math.max(0, v));
const dim = id => evaluation.dimensions.find(d => d.id === id);

// A machine's finish level is chosen with the design; standard is the default.
function finishLevel(id = 'standard') {
  const level = finish.levels.find(l => l.id === id);
  if (!level) throw new Error('Unknown finish level: ' + id);
  return level;
}

// The chosen case options move cooling, noise and appearance together.
function applyCaseOptions(chosen = {}) {
  let cooling = 1, noise = 1, appearance = 0;
  const picked = [];
  for (const group of caseOptions.groups) {
    const optionId = chosen[group.id];
    if (optionId === undefined) continue;
    const option = group.options.find(o => o.id === optionId);
    if (!option) throw new Error(`Unknown ${group.id} option: ${optionId}`);
    cooling *= option.coolingMultiplier;
    noise *= option.noiseMultiplier;
    appearance += option.appearancePoints;
    picked.push({ group: group.id, zh: group.zh, option: option.id, zhOption: option.zh, cost: option.cost, appearancePoints: option.appearancePoints });
  }
  return { cooling, noise, appearance, picked, cost: picked.reduce((n, p) => n + p.cost, 0) };
}

function evaluateDimensions(recipe, { targetUseCase, finishLevelId = 'standard', caseOptions: chosen = {} } = {}) {
  const report = evaluate(recipe);
  const target = targetUseCase || 'office';
  const level = finishLevel(finishLevelId);
  const build = applyCaseOptions(chosen);
  const budget = recipe.budgetCoins ? recipe.budgetCoins[1] : balance.recipes.find(r => r.id === recipe.id).budgetCoins[1];

  const t = dim('thermals');
  const rawThermals = report.thermalStable
    ? t.stableFloor + (100 - t.stableFloor) * clamp01(report.powerHeadroom / t.headroomReference)
    : (t.stableFloor - 20) * clamp01(report.powerHeadroom / t.headroomReference);
  const thermals = Math.min(100, rawThermals * build.cooling);
  const burden = report.noiseBurden * build.noise;

  const scores = {
    useCase: report.scores[target] ?? 0,
    performance: 100 * clamp01(Object.values(report.scores).reduce((n, v) => n + v, 0) / dim('performance').reference),
    thermals,
    noise: 100 * (1 - clamp01(burden / dim('noise').reference)),
    // Appearance is the sum of its parts but still has to respect the declared range.
    appearance: Math.min(100, finish.baseAppearancePoints + level.appearancePoints + build.appearance),
    cost: 100 * (1 - clamp01(report.partsCost / budget)),
  };
  return {
    scores,
    rounded: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, Math.round(v * 10) / 10])),
    report, finishLevel: level, targetUseCase: target,
    caseOptions: build.picked, caseOptionCost: build.cost, adjustedNoiseBurden: burden,
  };
}

module.exports = { evaluateDimensions, finishLevel, applyCaseOptions, evaluation, finish, caseOptions };
