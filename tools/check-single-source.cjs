// A fact written down twice will eventually be two different facts. Four constants in this
// codebase were each declared in two or three tools, agreeing by luck rather than by construction.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

// Generic names that happen to repeat without carrying a shared fact.
const GENERIC = new Set(['files', 'report', 'REQUIRED', 'rows', 'result', 'out', 'data', 'list', 'map', 'counts', 'values', 'keys', 'text', 'source', 'line', 'lines', 'index', 'item', 'items', 'entry', 'entries', 'config', 'options', 'output', 'input', 'state']);

function run() {
  const declared = {};
  const tools = fs.readdirSync(path.join(root, 'tools')).filter(f => f.endsWith('.cjs') && !f.startsWith('_tmp'));
  for (const tool of tools) {
    const text = fs.readFileSync(path.join(root, 'tools', tool), 'utf8');
    // Named constants written out as a literal, and objects built from literals.
    for (const m of text.matchAll(/^(?:const|let|var)\s+([A-Z][A-Z0-9_]{2,}|[a-zA-Z][a-zA-Z0-9]*)\s*=\s*(?!require)(.+)$/gm)) {
      const [, name, value] = m;
      if (GENERIC.has(name)) continue;
      // Only counts as a shared fact when the value is a literal or a literal structure.
      if (!/^[\d'"[{(-]/.test(value.trim())) continue;
      (declared[name] ||= new Set()).add(tool);
    }
  }
  const shared = Object.entries(declared)
    .filter(([, files]) => files.size > 1)
    .map(([name, files]) => name + ' in ' + [...files].join(', '));
  assert.equal(shared.length, 0,
    shared.length + ' constants are declared in more than one tool, so they can drift apart: ' + shared.join('; '));

  // The same field name carrying a value in two design files is either the same fact written
  // twice or two different concepts that happen to share a word. Neither is allowed to pass
  // unnoticed: the first has to be guarded or merged, the second has to be listed here.
  const KNOWN_SHARED_FIELDS = {
    monthlySalary: 'the demo employee is the skilled grade from staff.json; check-staff asserts they agree',
    monthlyLaborHours: 'same, asserted by check-staff',
    recruitmentCost: 'same, asserted by check-staff',
    appearancePoints: 'per case option in case-options and per finish level in finish-options; different scales',
    noiseMultiplier: 'per case option in case-options and per chassis in components; different stages of the same sum',
    height: 'a cooler or chassis height in components and a cable anchor height in workbench-geometry',
    throughMonth: 'the scenario window and the event window; check-events asserts they agree',
    testStationHours: 'how long a product is tested, and how long rework takes; different quantities',
    office: 'a use-case key in three different maps, not a value',
    gaming: 'a use-case key in three different maps, not a value',
    creation: 'a use-case key in two different maps, not a value',
    capacity: 'a memory size in the curve and a bay size in the geometry, different units',
    cost: 'a case option price and a product price; different tables',
    width: 'a component dimension and a cable anchor dimension',
    weight: 'an archetype share and an event outcome share; different distributions',
    ceiling: 'a price acceptance cap and a failure rate cap; different limits',
  };
  const RECORDS = new Set(['balance-baseline.json', 'economy-review-results.json', 'demo-baseline.json',
    'completion-audit.json', 'export-manifest.json', 'recorded-facts.json']);
  const NUMERIC_NAMES = /^(?!id$|zh$|note$|notes$|name$|status$|order$|schemaVersion$|basis$|source$|sources$|title$|detail$|reason$|label$|model$|description$|summary$|era$|segment$|category$|platform$|formFactor$|interface$|ramType$|socket$|quantity$|month$|year$|from$|through$|level$|tier$|phase$|step$|kind$|version$|count$|total$|entries$|index$)[a-zA-Z]/;
  const fieldFiles = {};
  const scanData = node => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const v of node) scanData(v); return; }
    for (const [k, v] of Object.entries(node)) {
      if ((typeof v === 'number' || typeof v === 'boolean') && NUMERIC_NAMES.test(k))
        (fieldFiles[k] ||= new Set()).add(scanData.file);
      else if (v && typeof v === 'object') scanData(v);
    }
  };
  for (const file of fs.readdirSync(path.join(root, 'design')).filter(f => f.endsWith('.json'))) {
    if (RECORDS.has(file)) continue;
    let doc;
    try { doc = JSON.parse(fs.readFileSync(path.join(root, 'design', file), 'utf8')); } catch { continue; }
    scanData.file = file;
    scanData(doc);
  }
  const unlisted = Object.entries(fieldFiles)
    .filter(([name, files]) => files.size > 1 && !KNOWN_SHARED_FIELDS[name])
    .map(([name, files]) => name + ' in ' + [...files].join(', '));
  assert.equal(unlisted.length, 0,
    unlisted.length + ' field names carry a value in more than one design file without being explained: ' + unlisted.join('; '));

  const output = {
    status: 'passed',
    toolsScanned: tools.length,
    sharedDataFieldsExplained: Object.keys(KNOWN_SHARED_FIELDS).length,
    sharedModules: fs.readdirSync(path.join(root, 'tools'))
      .filter(f => /^(demo-facts|mechanics-source|price-acceptance|experiment)\.cjs$/.test(f)),
    note: 'a fact needed by two tools belongs in a shared module, not copied into both',
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'single-source-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
