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

  const output = {
    status: 'passed',
    toolsScanned: tools.length,
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
