// Every cross-file id reference must resolve, so one renamed key cannot silently orphan another file.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

const components = read('components.json');
const balance = read('balance.json');
const economy = read('economy-candidate.json');
const supplier = read('supplier-system.json');
const customers = read('customer-model.json');
const events = read('market-events.json');
const workbench = read('workbench.json');
const routing = read('cable-routing.json');
const geometry = read('workbench-geometry.json');
const evaluation = read('evaluation.json');
const finish = read('finish-options.json');

// Each rule names what it reads, what it must resolve against, and how to pull the ids out.
function rules() {
  const partIds = new Set(components.parts.map(p => p.id));
  const categories = new Set(components.parts.map(p => p.category));
  const recipeIds = new Set(balance.recipes.map(r => r.id));
  const productIds = new Set(Object.keys(economy.products));
  const channelIds = new Set(supplier.channels.map(c => c.id));
  const investmentIds = new Set(Object.keys(economy.investments));
  const scenarioIds = new Set(Object.keys(economy.scenarios));
  const anchorIds = new Set(workbench.anchorDefinitions.map(a => a.id));
  const caseIds = new Set(components.parts.filter(p => p.category === 'case').map(p => p.id));

  return [
    { id: 'recipe_matches_product', zh: '配方与样机一一对应',
      from: [...recipeIds], to: [...productIds], kind: 'set' },
    { id: 'recipe_parts', zh: '配方引用的配件必须存在',
      from: balance.recipes.flatMap(r => {
        const ids = [];
        for (const key of ['cpu', 'motherboard', 'gpu', 'psu', 'cooler', 'case', 'systemDrive', 'workDrive'])
          if (r[key]) ids.push(`${r.id}.${key}=${typeof r[key] === 'string' ? r[key] : r[key].id}`);
        for (const key of ['ram', 'storage']) for (const e of r[key] || []) ids.push(`${r.id}.${key}=${e.id}`);
        return ids;
      }),
      to: [...partIds], kind: 'ref' },
    { id: 'route_channel', zh: '路线的采购渠道必须存在',
      from: Object.entries(economy.routes).map(([k, r]) => `${k}=${r.partsChannel}`),
      to: [...channelIds], kind: 'ref' },
    { id: 'route_investments', zh: '路线的投资必须存在',
      from: Object.entries(economy.routes).flatMap(([k, r]) => r.investments.map(p => `${k}=${p.id}`)),
      to: [...investmentIds], kind: 'ref' },
    { id: 'archetype_recipe', zh: '客户原型指向的样机必须存在',
      from: customers.archetypes.map(a => `${a.id}=${a.referenceRecipe}`),
      to: [...recipeIds], kind: 'ref' },
    { id: 'event_scenario', zh: '市场事件结果指向的情景必须存在',
      from: events.events.flatMap(e => e.outcomes.map(o => `${e.id}/${o.id}=${o.scenarioId}`)),
      to: [...scenarioIds], kind: 'ref' },
    { id: 'event_category', zh: '市场事件影响的品类必须存在',
      from: events.events.flatMap(e => e.affectedCategories.map(c => `${e.id}=${c}`)),
      to: [...categories], kind: 'ref' },
    { id: 'routing_anchors', zh: '线缆端点锚点必须存在',
      from: routing.roles.flatMap(r => [`${r.id}=${r.from}`, `${r.id}=${r.to}`]),
      to: [...anchorIds], kind: 'ref' },
    { id: 'geometry_case', zh: '几何机箱必须对应目录里的机箱',
      from: geometry.cases.map(c => c.caseId),
      to: [...caseIds], kind: 'ref' },
    { id: 'geometry_anchors', zh: '几何通道引用的锚点必须存在',
      from: geometry.cases.flatMap(c => c.channels.flatMap(ch => [ch.from, ch.to])),
      to: [...anchorIds], kind: 'ref' },
    { id: 'geometry_cables', zh: '几何线长必须覆盖每个线缆角色',
      from: [...new Set(geometry.cases.flatMap(c => Object.keys(c.cableLengths)))],
      to: routing.roles.map(r => r.id), kind: 'set' },
    { id: 'evaluation_finish', zh: '评价模型里的外观来源必须存在',
      from: [evaluation.dimensions.find(d => d.id === 'appearance')?.source],
      to: ['finishLevel'], kind: 'ref' },
    { id: 'finish_levels', zh: '工艺档位 id 必须唯一',
      from: finish.levels.map(l => l.id), to: finish.levels.map(l => l.id), kind: 'unique' },
    { id: 'part_ids', zh: '配件 id 必须唯一', from: components.parts.map(p => p.id), to: [], kind: 'unique' },
    { id: 'archetype_ids', zh: '客户原型 id 必须唯一', from: customers.archetypes.map(a => a.id), to: [], kind: 'unique' },
  ];
}

function run() {
  const report = [];
  for (const rule of rules()) {
    const list = rule.from.filter(Boolean);
    if (rule.kind === 'unique') {
      const seen = new Set(), dupes = [];
      for (const id of list) { if (seen.has(id)) dupes.push(id); seen.add(id); }
      assert.equal(dupes.length, 0, `${rule.zh}: 重复 id ${dupes.join(', ')}`);
      report.push({ id: rule.id, zh: rule.zh, checked: list.length, resolved: list.length });
      continue;
    }
    if (rule.kind === 'set') {
      const a = [...new Set(list)].sort(), b = [...new Set(rule.to)].sort();
      assert.deepEqual(a, b, `${rule.zh}: ${JSON.stringify(a)} 与 ${JSON.stringify(b)} 不是同一组`);
      report.push({ id: rule.id, zh: rule.zh, checked: a.length, resolved: a.length });
      continue;
    }
    const known = new Set(rule.to);
    const bad = list.filter(entry => !known.has(entry.split('=').pop()));
    assert.equal(bad.length, 0, `${rule.zh}: 解析失败 ${bad.join(', ')}`);
    report.push({ id: rule.id, zh: rule.zh, checked: list.length, resolved: list.length });
  }

  const output = {
    status: 'passed',
    rules: report.length,
    referencesChecked: report.reduce((n, r) => n + r.checked, 0),
    detail: report,
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'reference-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
