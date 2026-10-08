// Every rule a design file states must be read by the mechanics, or be listed here with a reason.
// This is the systematic form of the gaps found one at a time: appearance, quality tiers, release
// dates, customer gates, build compatibility and fan heat were all rules that nothing ever read.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

// The mechanics of the six-month demo, found by following what the simulator requires.
const { requireClosure, mechanicsSource } = require('./mechanics-source.cjs');

// Whole files that are not demo mechanics. Each entry states why the numbers are not rules here.
const WHOLE_FILES = {
  'balance-baseline.json': 'recorded output of the baseline run, not a rule',
  'demo-baseline.json': 'recorded scope of the demo, not a rule',
  'completion-audit.json': 'tooling record of what is finished, not a rule',
  'export-manifest.json': 'tooling record of what is exported, not a rule',
  'company-progression.json': 'full-game workshop ladder; the demo never leaves the first tier',
  'staff.json': 'full-game staffing and training; the demo runs one workshop employee',
  'supplier-system.json': 'full-game procurement draft; the demo models no goods in transit',
  'brands.json': 'supplier registry and naming rules, no demo mechanic reads it',
  'product-series.json': 'naming rules for series, no demo mechanic reads it',
  'market-events.json': 'guarded by check-events instead, which ties each outcome to its scenario',
  'era-trends.json': 'drives simulate-fullgame, not the six-month demo',
  'cable-routing.json': 'build interaction and geometry, guarded by check-cable-routing',
  'workbench.json': 'build interaction and geometry, guarded by check-cable-routing',
  'workbench-geometry.json': 'build interaction and geometry, guarded by check-cable-routing',
  'case-options.json': 'read through evaluate-product, which the simulator calls',
  'finish-options.json': 'read through evaluate-product, which the simulator calls',
  'demo-schedule.json': 'teaching order and unlocks, guarded by check-schedule',
  'design-flow.json': 'step mapping, guarded by check-flow',
  'evaluation.json': 'dimension definitions, guarded by check-seams and check-evaluation',
  'art-runtime.json': 'owned by the art workstream',
  'ui-system.json': 'owned by the interface workstream; its tokens describe layout rather than a
    numerical mechanic',
  'recorded-facts.json': 'measured design facts the checks assert against, not rules to implement',
  'catalog-2016-2020/cpu-motherboard.json': 'research record of what was verified, guarded by check-suppliers',
  'catalog-2016-2020/gpu.json': 'research record, guarded by check-suppliers',
  'catalog-2016-2020/memory-storage.json': 'research record, guarded by check-suppliers',
  'catalog-2016-2020/structural.json': 'research record, guarded by check-suppliers',
};

// Individual numbers inside otherwise mechanical files that are statements rather than mechanics.
const WHOLE_KEYS = {
  directCostsExcludeMonthlyBaseSalary: 'a statement about what direct costs contain, not a tunable',
  customerBudgetLockedAtOrderCreation: 'describes the full-game order book, which the demo regenerates monthly',
  informational: 'marks a dimension as display-only, consumed by check-seams',
  modelContainsSeries: 'a naming rule',
  demoSelected: 'marks a registry brand as present in the demo, consumed by check-supplier output',
  purchaseEntries: 'the confirmed thirty-two purchase entries, checked by check-package',
  cloudSaves: 'a presentation fact about the demo, not a mechanic',
  freeChoice: 'a teaching-order flag, guarded by check-schedule',
  totalEvents: 'a count of catalog events, guarded by check-era',
  generationLaunches: 'a count of catalog launches, guarded by check-era',
  observedYears: 'a count of catalog years, guarded by check-era',
  eventsPerYear: 'a derived average, guarded by check-era',
  generationLaunchesPerYear: 'a derived average, guarded by check-era',
  omenLeadsResolutionByMonths: 'guarded by check-events',
  outcomeIsDrawnOnce: 'guarded by check-events',
  seededForReproducibility: 'guarded by check-events',
  includesCooler: 'every catalogue processor ships without one, so the flag cannot yet make a cooler optional; doing so needs a stock-cooler entry that does not exist',
  dataRateMtps: 'no two catalogue kits of the same type differ in speed, so it cannot yet separate a build',
  maxDataRateMtps: 'matches the speed of its own memory type; the type gate already covers it',
  modular: 'cable management appearance, no mechanical effect is modelled',
  cpuFanHeaders: 'the fan model counts case fans through maxFans and the hub, not through board headers',
  caseFanControlInputs: 'the fan model counts case fans through maxFans and the hub, not through board headers',
  mainboardPowerConnectors: 'every catalogue supply carries exactly one, so the gate can never bind',
};

// Paths inside mechanical files that hold raw reference specifications rather than game rules.
const WHOLE_PATHS = [
  'parts.reference.specs',
  'parts.game.dimensionsMm',
  'parts.availability',
  'parts.legacyDisplayNames',
  'parts.game.gpuSlots',
  'parts.game.modelHeightMm',
];

function run() {
  const mechanics = mechanicsSource();
  const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Walk the whole tree. Reading only the top level meant the four research files under
  // design/catalog-2016-2020 were never examined, and were not listed as excused either, so the
  // check could not tell "nothing in there needs wiring" from "nothing in there was looked at".
  const files = [];
  const walkDesign = dir => {
    for (const entry of fs.readdirSync(path.join(root, 'design', dir), { withFileTypes: true })) {
      const rel = dir ? dir + '/' + entry.name : entry.name;
      if (entry.isDirectory()) walkDesign(rel);
      else if (entry.name.endsWith('.json')) files.push(rel);
    }
  };
  walkDesign('');

  const unwired = [];
  const checked = { files: 0, numbers: 0, skippedFiles: Object.keys(WHOLE_FILES).length };

  for (const file of files) {
    if (WHOLE_FILES[file]) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(root, 'design', file), 'utf8'));
    checked.files++;
    const visit = (node, trail) => {
      if (node === null || typeof node !== 'object') return;
      if (Array.isArray(node)) { for (const value of node) visit(value, trail); return; }
      for (const [key, value] of Object.entries(node)) {
        const where = trail + key;
        if (typeof value === 'number' || typeof value === 'boolean') {
          if (WHOLE_KEYS[key]) continue;
          if (WHOLE_PATHS.some(p => where.includes(p))) continue;
          checked.numbers++;
          if (!new RegExp('\\b' + escapeRe(key) + '\\b').test(mechanics)) unwired.push(file + ':' + where);
        } else if (value && typeof value === 'object') {
          visit(value, where + '.');
        }
      }
    };
    visit(doc, '');
  }

  assert.equal(unwired.length, 0,
    unwired.length + ' rules are stated in a design file but no demo mechanic reads them: ' + unwired.join(', '));

  const output = {
    status: 'passed',
    filesScanned: checked.files,
    numbersChecked: checked.numbers,
    filesExcused: Object.keys(WHOLE_FILES).length,
    keysExcused: Object.keys(WHOLE_KEYS).length,
    pathsExcused: WHOLE_PATHS.length,
    mechanics: requireClosure(),
    note: '每一个豁免都写明了理由；新增规则若没人读取，这一项就会失败',
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'wiring-verification.json'), JSON.stringify({ ...output, WHOLE_FILES, WHOLE_KEYS, WHOLE_PATHS }, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
