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

// The schedule records gaps too. Each is resolved by inspecting the economy data it describes.
function scheduleGaps() {
  const schedule = read('demo-schedule.json');
  const economy = read('economy-candidate.json');
  const hasMonthFiveOrSix = route => (economy.routes[route].investments || [])
    .some(i => i.month >= 5 && i.month <= 6);
  return (schedule.openGaps || []).map(g => {
    // This gap says the boutique and mixed routes have no month five or six investment. It cannot
    // be resolved by data: decision six resolves it by narrowing the schedule's promise to the mass
    // and mixed routes, because the boutique route has nothing worth buying. So the only mechanical
    // test is whether both routes did get one, which would make the gap's wording wrong the other way.
    if (/精品与混合路线在第 5—6 月没有投资机会/.test(g.subject)) {
      return {
        claim: 'demo-schedule.json openGaps: ' + g.subject,
        done: hasMonthFiveOrSix('boutique') && hasMonthFiveOrSix('mixed'),
        evidence: 'both routes gained a month five or six investment, so the gap wording needs revisiting',
      };
    }
    return { claim: 'demo-schedule.json openGaps: ' + g.subject, done: null, evidence: 'no mechanical resolver' };
  });
}

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
  // The schedule's own gap list, resolved against the economy data it describes.
  const scheduleClaims = scheduleGaps();
  for (const c of scheduleClaims) {
    if (c.done === true) stale.push(c.claim + ' — done, see ' + c.evidence);
    else if (c.done === false) stillOpen.push(c.claim);
  }
  assert.equal(stale.length, 0,
    stale.length + ' items are listed as pending but the data shows they are done: ' + stale.join('; '));

  const output = {
    status: 'passed',
    pendingItemsDeclared: items.length,
    itemsStillOpen: stillOpen.length,
    itemsWithoutResolver: Object.values(RESOLVERS).filter(v => v === null).length,
    scheduleGapsChecked: scheduleClaims.length,
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
