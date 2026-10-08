// The source of the demo's mechanics, found by following what the simulator actually requires.
// Keeping this list by hand is how a newly extracted module goes unnoticed: price-acceptance.cjs
// was invisible to the wiring check until it was added manually.
const fs = require('node:fs');
const path = require('node:path');

const toolsDir = __dirname;
const ENTRY = 'simulate-economy.cjs';
// Node's own modules and the two checkers the simulator borrows a pure function from.
const SKIP = new Set(['node:fs', 'node:path', 'node:assert', 'node:assert/strict', 'node:url',
  'node:module', 'node:os', 'node:child_process', 'fs', 'path', 'assert', 'url']);
// check-customers and check-design arrive because the simulator borrows a pure helper from each.
// Their assertions are not the point, but their helper functions do read design fields, so their
// source counts as mechanics too and they are deliberately not filtered out.

function localRequires(source) {
  const names = [];
  for (const m of source.matchAll(/require\(\s*['"]\.\/([^'"]+)['"]\s*\)/g)) names.push(m[1]);
  return names;
}

// Every file the entry reaches through local requires, in a stable order.
function requireClosure(entry = ENTRY) {
  const seen = new Set();
  const order = [];
  const walk = name => {
    if (seen.has(name)) return;
    seen.add(name);
    order.push(name);
    const full = path.join(toolsDir, name);
    if (!fs.existsSync(full)) return;
    for (const next of localRequires(fs.readFileSync(full, 'utf8'))) walk(next);
  };
  walk(entry);
  return order;
}

// The concatenated source the checks scan for the presence of a field name.
function mechanicsSource() {
  return requireClosure()
    .map(name => {
      const full = path.join(toolsDir, name);
      return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
    })
    .join('\n');
}

module.exports = { requireClosure, mechanicsSource, ENTRY };
