// Case customisation must offer specific options with costs and honest trade-offs.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { evaluateDimensions, applyCaseOptions } = require('./evaluate-product.cjs');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

const model = read('case-options.json');
const balance = read('balance.json');
// The brief names these six.
const REQUIRED = { front_panel: '面板', side_panel: '侧板', storage_bays: '储存托架', fan_positions: '风扇位', colour: '颜色', lighting: '灯效' };

function run() {
  assert.equal(model.schemaVersion, 1, 'schema');
  assert(model.status && model.provenance?.existing && model.provenance?.new && model.provenance?.limits, 'provenance');

  const ids = model.groups.map(g => g.id);
  for (const [id, zh] of Object.entries(REQUIRED)) {
    assert(ids.includes(id), `the brief requires a ${zh} group`);
    assert.equal(model.groups.find(g => g.id === id).zh, zh, `group ${id} is labelled wrongly`);
  }
  assert.equal(new Set(ids).size, ids.length, 'duplicate group id');

  const defaults = {}, best = {};
  for (const group of model.groups) {
    assert(group.options.length >= 2, `${group.id}: a group with one option is not a choice`);
    const free = group.options.filter(o => o.cost === 0);
    assert.equal(free.length, 1, `${group.id}: exactly one option must be the free default`);
    defaults[group.id] = free[0].id;
    for (const o of group.options) {
      assert(o.zh && o.note, `${group.id}/${o.id}: name and note`);
      assert(Number.isFinite(o.cost) && o.cost >= 0, `${group.id}/${o.id}: cost`);
      assert(Number.isFinite(o.coolingMultiplier) && o.coolingMultiplier > 0, `${group.id}/${o.id}: cooling`);
      assert(Number.isFinite(o.noiseMultiplier) && o.noiseMultiplier > 0, `${group.id}/${o.id}: noise`);
      assert(Number.isFinite(o.appearancePoints) && o.appearancePoints >= 0, `${group.id}/${o.id}: appearance points`);
      if (o.id !== free[0].id) {
        // Anything above the default must cost money or buy something.
        const buys = o.cost > 0 || o.coolingMultiplier !== 1 || o.noiseMultiplier !== 1 || o.appearancePoints > 0;
        assert(buys, `${group.id}/${o.id}: a non-default option that costs nothing and changes nothing is dead`);
      }
    }
    // Inside a group there must be no option that wins on everything.
    for (const o of group.options) {
      const dominates = group.options.some(x =>
        x.id !== o.id && x.cost <= o.cost && x.coolingMultiplier >= o.coolingMultiplier &&
        x.noiseMultiplier <= o.noiseMultiplier && x.appearancePoints >= o.appearancePoints &&
        (x.cost < o.cost || x.coolingMultiplier > o.coolingMultiplier || x.noiseMultiplier < o.noiseMultiplier || x.appearancePoints > o.appearancePoints));
      assert(!dominates, `${group.id}/${o.id}: another option is better and no more expensive, so this one is never worth taking`);
    }
    best[group.id] = { coolest: group.options.reduce((a, b) => b.coolingMultiplier > a.coolingMultiplier ? b : a).id,
      quietest: group.options.reduce((a, b) => b.noiseMultiplier < a.noiseMultiplier ? b : a).id };
  }

  // The options must actually reach the evaluation.
  const recipe = balance.recipes.find(r => r.id === 'gaming');
  const plain = evaluateDimensions(recipe, { targetUseCase: 'gaming' });
  const dressed = evaluateDimensions(recipe, { targetUseCase: 'gaming', caseOptions: {
    front_panel: 'mesh', side_panel: 'glass', lighting: 'argb', colour: 'custom' } });
  assert(dressed.scores.appearance > plain.scores.appearance, 'case options did not raise the appearance score');
  // mesh 60 + glass 90 + argb 120 + custom colour 150
  assert.equal(dressed.caseOptionCost, 420, `expected the chosen options to cost 420, got ${dressed.caseOptionCost}`);

  // Appearance must be explainable: the parts have to add up to the total.
  const byHand = read('finish-options.json').baseAppearancePoints +
    read('finish-options.json').levels.find(l => l.id === 'standard').appearancePoints +
    applyCaseOptions({ front_panel: 'mesh', side_panel: 'glass', lighting: 'argb', colour: 'custom' }).appearance;
  assert.equal(dressed.scores.appearance, byHand,
    `appearance ${dressed.scores.appearance} does not match the sum of its parts ${byHand}`);

  // A cooler panel must be louder, or the groups are not trade-offs.
  const panel = model.groups.find(g => g.id === 'front_panel');
  const mesh = panel.options.find(o => o.id === 'mesh'), damped = panel.options.find(o => o.id === 'damped');
  assert(mesh.coolingMultiplier > damped.coolingMultiplier && mesh.noiseMultiplier > damped.noiseMultiplier,
    'the panel group does not trade cooling against noise');

  const output = {
    status: 'passed',
    groups: model.groups.map(g => ({ id: g.id, zh: g.zh, options: g.options.length, default: defaults[g.id] })),
    totalOptions: model.groups.reduce((n, g) => n + g.options.length, 0),
    tradeOffs: best,
    workedExample: {
      recipe: 'gaming',
      plain: plain.rounded,
      withOptions: dressed.rounded,
      optionCost: dressed.caseOptionCost,
      appearanceAddsUp: byHand,
    },
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'case-options-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
