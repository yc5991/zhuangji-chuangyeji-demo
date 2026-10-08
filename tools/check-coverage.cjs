// Every design file must be read by some checker, directly or through the simulator.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const toolsDir = path.join(root, 'tools');

// Tools that exist to compute rather than to police a file.
const META_TOOLS = ['check-package.cjs', 'balance-baseline.cjs', 'preview-proposal.cjs',
  'prepare-demo.cjs', 'normalize-catalog.cjs', 'analyze-sensitivity.cjs',
  // Reads the tools rather than the data, so it polices coverage instead of a file.
  'check-coverage.cjs',
  // Reads every design file dynamically, so no single file appears in its source.
  'check-wiring.cjs',
  // Reads the tools rather than the data, looking for facts declared in more than one place.
  'check-single-source.cjs'];
// Files owned by another workstream; reported, not enforced.
const OWNED_ELSEWHERE = ['art-runtime.json'];

// The research files, reached through a computed path rather than a literal one, so a checker that
// reads the catalogue directory covers all four.
const CATALOG_FILES = ['cpu-motherboard.json', 'gpu.json', 'memory-storage.json', 'structural.json'];

function designReads(src) {
  const found = new Set();
  for (const m of src.matchAll(/read\(\s*'([^']+\.json)'/g)) found.add(path.basename(m[1]));
  // A computed path into the catalogue directory covers every research file in it.
  if (/design[\\/]catalog-2016-2020/.test(src) || /read\(\s*path\.join\(\s*'design/.test(src))
    for (const name of CATALOG_FILES) found.add('catalog-2016-2020/' + name);
  // Any mention of design/<file>.json counts, whatever wrapper it uses.
  for (const m of src.matchAll(/design[\\/]([a-z0-9-]+\.json)/g)) found.add(m[1]);
  return found;
}
function importsSimulator(src) {
  return /require\([^)]*simulate-economy\.cjs/.test(src);
}

function run() {
  // Walk the whole tree. Reading only the top level left the four research files under
  // design/catalog-2016-2020 out of the count entirely, so the check was reporting coverage of
  // twenty-seven files when there were thirty-one.
  const designFiles = [];
  const walkDesign = dir => {
    for (const entry of fs.readdirSync(path.join(root, 'design', dir), { withFileTypes: true })) {
      const rel = dir ? dir + '/' + entry.name : entry.name;
      if (entry.isDirectory()) walkDesign(rel);
      else if (entry.name.endsWith('.json')) designFiles.push(rel);
    }
  };
  walkDesign('');
  const toolNames = fs.readdirSync(toolsDir).filter(f => f.endsWith('.cjs'));
  const sources = Object.fromEntries(toolNames.map(t => [t, fs.readFileSync(path.join(toolsDir, t), 'utf8')]));

  const simulatorReads = designReads(sources['simulate-economy.cjs'] || '');

  const coverage = {};
  for (const file of designFiles) coverage[file] = [];
  for (const tool of toolNames) {
    const direct = designReads(sources[tool]);
    if (importsSimulator(sources[tool])) for (const f of simulatorReads) direct.add(f);
    for (const f of direct) if (coverage[f]) coverage[f].push(tool);
  }

  const uncovered = designFiles.filter(f => coverage[f].length === 0);
  const mine = uncovered.filter(f => !OWNED_ELSEWHERE.includes(f));
  const theirs = uncovered.filter(f => OWNED_ELSEWHERE.includes(f));

  // A checker that reads no design file is not policing anything.
  const idle = [];
  for (const tool of toolNames) {
    if (!tool.startsWith('check-')) continue;
    const direct = designReads(sources[tool]);
    if (importsSimulator(sources[tool])) for (const f of simulatorReads) direct.add(f);
    if (direct.size === 0 && !META_TOOLS.includes(tool)) idle.push(tool);
  }
  assert.equal(idle.length, 0, `${idle.length} checkers read no design file: ${idle.join(', ')}`);

  // A tool that no script runs and no other tool requires is either dead or unwired. Both are
  // worth knowing about: preview.cjs served the web build but had no script to launch it.
  const scriptText = Object.values(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts).join(' ');
  const required = new Set();
  for (const tool of toolNames) {
    const src = sources[tool];
    for (const m of src.matchAll(/require\(['"]\.\/([^'"]+\.cjs)['"]\)/g)) required.add(m[1]);
  }
  const orphans = toolNames.filter(t => !scriptText.includes(t) && !required.has(t));
  assert.equal(orphans.length, 0,
    `${orphans.length} tools are unreachable from every script and every other tool: ${orphans.join(', ')}`);

  const output = {
    status: mine.length ? 'failed' : 'passed',
    designFiles: designFiles.length,
    checkers: toolNames.filter(t => t.startsWith('check-')).length,
    simulatorReads: simulatorReads.size,
    uncoveredMine: mine,
    uncoveredOwnedElsewhere: theirs,
    leastCovered: Object.entries(coverage)
      .map(([f, who]) => ({ file: f, readers: who.length }))
      .sort((a, b) => a.readers - b.readers)
      .slice(0, 5),
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'coverage-verification.json'), JSON.stringify({ ...output, coverage }, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  if (mine.length) assert.fail(`${mine.length} design files have no checker reading them: ${mine.join(', ')}`);
  return output;
}
if (require.main === module) run();
module.exports = { run };
