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
  'check-wiring.cjs'];
// Files owned by another workstream; reported, not enforced.
const OWNED_ELSEWHERE = ['art-runtime.json'];

function designReads(src) {
  const found = new Set();
  for (const m of src.matchAll(/read\(\s*'([^']+\.json)'/g)) found.add(path.basename(m[1]));
  for (const m of src.matchAll(/read\(\s*path\.join\(\s*'([^']+)'/g)) found.add(m[1].startsWith('design') ? '(catalog)' : '(dir)');
  // Any mention of design/<file>.json counts, whatever wrapper it uses.
  for (const m of src.matchAll(/design[\\/]([a-z0-9-]+\.json)/g)) found.add(m[1]);
  return found;
}
function importsSimulator(src) {
  return /require\([^)]*simulate-economy\.cjs/.test(src);
}

function run() {
  const designFiles = fs.readdirSync(path.join(root, 'design')).filter(f => f.endsWith('.json'));
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
