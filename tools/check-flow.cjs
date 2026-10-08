// The seven-step design flow must cover every hour and cost a product carries, exactly once.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

const flow = read('design-flow.json');
const economy = read('economy-candidate.json');
const reliability = read('reliability-model.json');
const finish = read('finish-options.json');

// spec section 6.1 names these seven, in this order.
const CONFIRMED = ['确定定位', '选择配件', '设计装配与外观', '制作样机', '测试修改', '命名定价', '交付或投产'];
const RESOURCES = ['labor', 'owner', 'bench', 'test'];
// Fields that live on a product and must each belong to one step.
const HOUR_FIELDS = ['designHours', 'assemblyHours', 'testSetupHours', 'testStationHours', 'packingHours',
  'developmentLaborHours', 'developmentBenchHours', 'developmentTestHours'];

function run() {
  assert.equal(flow.schemaVersion, 1, 'schema');
  assert(flow.status && flow.provenance?.existing && flow.provenance?.new && flow.provenance?.limits, 'provenance');

  assert.equal(flow.steps.length, CONFIRMED.length, `the spec confirms ${CONFIRMED.length} steps`);
  flow.steps.forEach((step, i) => {
    assert.equal(step.zh, CONFIRMED[i], `step ${i + 1} is ${step.zh}, the spec says ${CONFIRMED[i]}`);
    assert.equal(step.order, i + 1, `${step.zh}: order must match position`);
    assert(step.note, `${step.zh}: needs a note`);
    assert(Array.isArray(step.consumes) && Array.isArray(step.hourFields) &&
      Array.isArray(step.costFields) && Array.isArray(step.produces), `${step.zh}: list fields`);
    for (const r of step.consumes) assert(RESOURCES.includes(r), `${step.zh}: unknown resource ${r}`);
    // A step that claims a resource has to say where its hours come from.
    if (step.consumes.length) assert(step.hourFields.length, `${step.zh} consumes capacity but names no hour field`);
    if (step.hourFields.length) assert(step.consumes.length, `${step.zh} names hour fields but claims no capacity`);
  });
  assert(new Set(flow.steps.map(s => s.id)).size === flow.steps.length, 'duplicate step id');

  // Every hour field on a product must be claimed by exactly one step.
  const claimed = {};
  for (const step of flow.steps) for (const f of step.hourFields) (claimed[f] ||= []).push(step.id);
  const product = Object.values(economy.products)[0];
  for (const f of HOUR_FIELDS) {
    assert(f in product, `${f} is not a product field any more`);
    assert(claimed[f], `${f} carries hours but no step claims it`);
    assert.equal(claimed[f].length, 1, `${f} is claimed by ${claimed[f].join(' and ')}`);
  }
  for (const f of Object.keys(claimed)) assert(HOUR_FIELDS.includes(f), `step claims unknown field ${f}`);

  // Cost sources must resolve to something real.
  const costSources = new Set(flow.steps.flatMap(s => s.costFields));
  const knownCosts = new Set(['partsCost', 'developmentCost', 'finishConsumables', 'directCostCoins', 'reworkConsumables', 'deliveryCost']);
  for (const c of costSources) assert(knownCosts.has(c), `unknown cost source ${c}`);
  for (const c of knownCosts) assert(costSources.has(c), `cost source ${c} is not owned by any step`);
  // These must resolve, or the flow points at nothing.
  assert(reliability.rework.consumablesCoins > 0, 'reworkConsumables must resolve to the reliability model');
  assert(finish.levels.some(l => l.additionalConsumablesCoins > 0), 'finishConsumables must resolve to the finish model');

  // Development work is spent once, per-unit work every time; the two must not be confused.
  const design = flow.steps.find(s => s.id === 'design');
  const deliver = flow.steps.find(s => s.id === 'deliver');
  assert(design.hourFields.includes('developmentLaborHours'), 'first-time design work belongs to the design step');
  assert(!deliver.hourFields.some(f => f.startsWith('development')), 'delivery must not charge development work');

  const output = {
    status: 'passed',
    steps: flow.steps.map(s => ({ order: s.order, zh: s.zh, consumes: s.consumes, hourFields: s.hourFields, costFields: s.costFields })),
    hourFieldsClaimed: Object.keys(claimed).length,
    hourFieldsOnProduct: HOUR_FIELDS.length,
    costSources: [...costSources].sort(),
    resources: RESOURCES,
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'flow-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
