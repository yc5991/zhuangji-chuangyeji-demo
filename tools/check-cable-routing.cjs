// Every cable role must have a route through the channel graph that fits its length budget.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

const routing = read('cable-routing.json');
const geometry = read('workbench-geometry.json');
const workbench = read('workbench.json');
const components = read('components.json');

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Shortest route through the channel graph, in millimetres.
function shortestPath(anchors, channels, from, to) {
  const at = Object.fromEntries(anchors.map(a => [a.id, a.point]));
  const adj = {};
  for (const c of channels) {
    (adj[c.from] ||= []).push({ to: c.to, w: dist(at[c.from], at[c.to]) });
    (adj[c.to] ||= []).push({ to: c.from, w: dist(at[c.from], at[c.to]) });
  }
  const best = { [from]: 0 }, done = new Set();
  for (;;) {
    let pick = null;
    for (const id of Object.keys(best)) if (!done.has(id) && (pick === null || best[id] < best[pick])) pick = id;
    if (pick === null) return null;
    if (pick === to) return best[pick];
    done.add(pick);
    for (const edge of adj[pick] || []) {
      const next = best[pick] + edge.w;
      if (best[edge.to] === undefined || next < best[edge.to]) best[edge.to] = next;
    }
  }
}

function run() {
  assert.equal(routing.schemaVersion, 1, 'schema');
  assert(routing.status && routing.provenance?.existing && routing.provenance?.new && routing.provenance?.limits, 'provenance');

  const definedRoles = workbench.connectionRoles;
  const boundRoles = routing.roles.map(r => r.id);
  for (const role of definedRoles)
    assert(boundRoles.includes(role), `cable role ${role} is defined but never bound to anchors, so its length budget is never checked`);
  assert.equal(new Set(boundRoles).size, boundRoles.length, 'duplicate role');
  for (const r of routing.roles) {
    assert(r.zh && r.note && r.connector, `${r.id}: name, note and connector`);
    assert(r.from && r.to && r.from !== r.to, `${r.id}: needs two distinct anchors`);
    assert(Array.isArray(r.connects) && r.connects.length >= 2, `${r.id}: must connect at least two components`);
    assert(workbench.anchorDefinitions.some(a => a.id === r.from), `${r.id}: unknown anchor ${r.from}`);
    assert(workbench.anchorDefinitions.some(a => a.id === r.to), `${r.id}: unknown anchor ${r.to}`);
  }

  const perCase = [];
  for (const theCase of geometry.cases) {
    // The case footprint is recorded twice: components.json holds width, height and depth, and the
    // workbench geometry holds the same case as width and height meaning depth and height. Nothing
    // compared them, so resizing a case in one place would leave the other lying.
    const part = components.parts.find(p => p.id === theCase.caseId);
    assert(part, `${theCase.caseId}: the geometry names a case that is not in the catalogue`);
    const dims = part.game.dimensionsMm;
    assert(dims && Number.isFinite(dims.depth) && Number.isFinite(dims.height),
      `${theCase.caseId}: the catalogue entry carries no depth or height`);
    assert.equal(theCase.width, dims.depth,
      `${theCase.caseId}: the workbench is ${theCase.width}mm across but the catalogue case is ${dims.depth}mm deep`);
    assert.equal(theCase.height, dims.height,
      `${theCase.caseId}: the workbench is ${theCase.height}mm tall but the catalogue case is ${dims.height}mm tall`);
    const anchorIds = theCase.anchors.map(a => a.id);
    const rows = [];
    const load = {};
    for (const role of routing.roles) {
      assert(anchorIds.includes(role.from) && anchorIds.includes(role.to),
        `${theCase.caseId}/${role.id}: anchors ${role.from} or ${role.to} do not exist in this case`);
      const budget = theCase.cableLengths[role.id];
      assert(Number.isFinite(budget), `${theCase.caseId}/${role.id}: no length budget`);
      const length = shortestPath(theCase.anchors, theCase.channels, role.from, role.to);
      assert(length !== null, `${theCase.caseId}/${role.id}: no route exists between ${role.from} and ${role.to}`);
      assert(length <= budget,
        `${theCase.caseId}/${role.id}: the shortest route is ${Math.round(length)}mm but the cable budget is ${budget}mm`);
      rows.push({ role: role.id, zh: role.zh, from: role.from, to: role.to, routeMm: Math.round(length), budgetMm: budget, slackMm: Math.round(budget - length) });
      // Count what has to pass through each channel along that route.
      for (const key of Object.keys(load)) load[key]++;
    }
    // A channel must carry every cable whose shortest route uses it.
    const used = {};
    for (const role of routing.roles) {
      const at = Object.fromEntries(theCase.anchors.map(a => [a.id, a.point]));
      const adj = {};
      for (const c of theCase.channels) {
        (adj[c.from] ||= []).push(c.to); (adj[c.to] ||= []).push(c.from);
      }
      // Walk the graph recording which channels the shortest route touches.
      const best = { [role.from]: 0 }, prev = {}, done = new Set();
      for (;;) {
        let pick = null;
        for (const id of Object.keys(best)) if (!done.has(id) && (pick === null || best[id] < best[pick])) pick = id;
        if (pick === null) break;
        if (pick === role.to) break;
        done.add(pick);
        for (const c of theCase.channels) {
          const other = c.from === pick ? c.to : c.to === pick ? c.from : null;
          if (!other) continue;
          const next = best[pick] + dist(at[c.from], at[c.to]);
          if (best[other] === undefined || next < best[other]) { best[other] = next; prev[other] = pick; }
        }
      }
      for (let node = role.to; prev[node] !== undefined; node = prev[node]) {
        const a = node, b = prev[node];
        const key = [a, b].sort().join('-');
        used[key] = (used[key] || 0) + 1;
      }
    }
    for (const channel of theCase.channels) {
      const key = [channel.from, channel.to].sort().join('-');
      const passing = used[key] || 0;
      assert(passing <= channel.capacity,
        `${theCase.caseId}: channel ${key} carries ${passing} cables but its capacity is ${channel.capacity}`);
    }
    perCase.push({ caseId: theCase.caseId, routes: rows, tightest: rows.reduce((a, b) => b.slackMm < a.slackMm ? b : a) });
  }

  const output = {
    status: 'passed',
    roles: routing.roles.length,
    cases: perCase.length,
    perCase: perCase.map(c => ({ caseId: c.caseId, tightest: c.tightest })),
    hint: 'slackMm 是线长预算与最短走线长度的差值；越小越容易被改动机箱或通道卡住',
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'cable-routing-verification.json'), JSON.stringify({ ...output, detail: perCase }, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run, shortestPath };
