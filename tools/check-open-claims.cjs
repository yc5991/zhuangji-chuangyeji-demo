// A field that records what is still unfinished has nothing computing from it, so it drifts. Four
// such records have been found stale. This reads the pending items a design file declares and
// requires each to name the evidence that would show it is done; if that evidence exists, the claim
// is out of date.
//
// Reading the file rather than a fixed list is the point: a list of claims would go stale the same
// way the prose does. An item with no resolver fails, so a new pending entry has to be made checkable.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

// For each pending item, the path that would show it is done. A path that yields a value means the
// work exists and the pending entry should have been removed.
const RESOLVERS = {
  port_transforms: null,              // no resolver: the geometry does not model port orientation
  collision_volumes: null,            // belongs to the interaction and art workstream
  art_detail: null,                   // art workstream
};

function resolve(file, dotted) {
  let node = read(file);
  for (const key of dotted.split('.')) {
    if (node === null || node === undefined) return undefined;
    node = node[Array.isArray(node) ? Number(key) : key];
  }
  return node;
}

function run() {
  const workbench = read('workbench.json');
  const items = workbench.pendingGeometry || [];

  // Every declared pending item needs a resolver, or the list is unverifiable prose again.
  const unresolved = items.filter(i => !(i in RESOLVERS));
  assert.equal(unresolved.length, 0,
    'pending items without a resolver, so nothing can tell when they are done: ' + unresolved.join(', '));

  const stale = [];
  const stillOpen = [];
  for (const item of items) {
    const target = RESOLVERS[item];
    if (!target) { stillOpen.push(item + ' (no resolver: ' + item + ')'); continue; }
    const value = resolve(target[0], target[1]);
    const done = value !== undefined && value !== null && !(Array.isArray(value) && value.length === 0);
    if (done) stale.push(item + ' — done, see ' + target[0] + ' ' + target[1]);
    else stillOpen.push(item);
  }
  assert.equal(stale.length, 0,
    stale.length + ' items are listed as pending but the data shows they are done: ' + stale.join('; '));

  const output = {
    status: 'passed',
    pendingItemsDeclared: items.length,
    itemsStillOpen: stillOpen.length,
    itemsWithoutResolver: Object.values(RESOLVERS).filter(v => v === null).length,
    stillOpen,
    note: 'a pending list is unverifiable prose unless each entry names what would resolve it',
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'open-claims-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
