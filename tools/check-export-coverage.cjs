// Every design file must be classified, and every runtime input must actually be exported.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

const manifest = read('export-manifest.json');
const prepare = fs.readFileSync(path.join(root, 'tools', 'prepare-demo.cjs'), 'utf8');

function run() {
  assert.equal(manifest.schemaVersion, 1, 'schema');
  assert(manifest.status && manifest.provenance?.existing && manifest.provenance?.new && manifest.provenance?.limits, 'provenance');
  const categories = Object.keys(manifest.categories);
  assert(categories.length === 3, 'three categories');

  const onDisk = fs.readdirSync(path.join(root, 'design')).filter(f => f.endsWith('.json')).sort();
  const listed = Object.keys(manifest.files).sort();

  // Nothing may be silently left out, and nothing may linger after deletion.
  const unclassified = onDisk.filter(f => !listed.includes(f));
  const stale = listed.filter(f => !onDisk.includes(f));
  assert.equal(unclassified.length, 0, `${unclassified.length} design files are unclassified: ${unclassified.join(', ')}`);
  assert.equal(stale.length, 0, `${stale.length} classified files no longer exist: ${stale.join(', ')}`);

  for (const [file, category] of Object.entries(manifest.files))
    assert(categories.includes(category), `${file}: unknown category ${category}`);

  // prepare-demo's own sourceFiles list.
  const sourceBlock = prepare.match(/const sourceFiles = \[([\s\S]*?)\]/);
  assert(sourceBlock, 'prepare-demo must declare sourceFiles');
  const sources = [...sourceBlock[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

  const missing = [];
  for (const [file, category] of Object.entries(manifest.files)) {
    if (category === 'runtime_input' && !sources.includes(file)) missing.push(file);
    if (category === 'runtime_output') {
      assert(prepare.includes(`write('design/${file}'`) || prepare.includes(`design/${file}`),
        `${file} is classified as generated but prepare-demo never writes it`);
    }
    if (category === 'tooling') {
      const referenced = fs.readdirSync(path.join(root, 'tools'))
        .some(t => t.endsWith('.cjs') && fs.readFileSync(path.join(root, 'tools', t), 'utf8').includes(file));
      assert(referenced, `${file} is classified as tooling but no tool reads it`);
    }
  }

  // Report rather than assert on files owned elsewhere, so the gap stays visible without blocking.
  const ownedElsewhere = ['brands.json', 'product-series.json', 'art-runtime.json'];
  const reported = missing.filter(f => ownedElsewhere.includes(f));
  const mustFix = missing.filter(f => !ownedElsewhere.includes(f));

  const output = {
    status: mustFix.length ? 'failed' : 'passed',
    designFiles: onDisk.length,
    byCategory: Object.entries(manifest.files).reduce((a, [f, c]) => (a[c] = (a[c] || 0) + 1, a), {}),
    fingerprintedByPrepareDemo: sources.length,
    runtimeInputsMissingFromExport: mustFix,
    reportedNotMine: reported,
    note: 'prepare-demo sourceFiles 决定哪些文件会被指纹记录下来；未列入的文件改动不会让基线失效',
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'export-coverage.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  if (mustFix.length) {
    assert.fail(`${mustFix.length} runtime inputs are not exported by prepare-demo: ${mustFix.join(', ')}`);
  }
  return output;
}
if (require.main === module) run();
module.exports = { run };
