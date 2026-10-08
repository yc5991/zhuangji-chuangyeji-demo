// The design files have checks proving the simulator reads them. Nothing proved the game does,
// and three rounds in a row found the game diverging from the design without a single check failing.
// This closes that seam: what the game is given, and which design rules it never implements.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

// Design files whose rules the game is expected to implement, and the marker that shows it does.
// A file listed here must be either carried into the generated data or visibly implemented in code;
// one that is neither is a rule the game does not have.
const GAME_MUST_IMPLEMENT = {
  'reliability-model.json': { carried: false, markers: ['failureRate', 'escapeRate', 'arrivalDefect'],
    note: 'faults, quality control and arrival defects' },
  'evaluation.json': { carried: false, markers: ['evaluateDimensions', 'stableFloor', 'headroomReference'],
    note: 'the six scored dimensions the specification promises the player' },
};

// Full-game files the demo deliberately does not need.
const DEMO_DOES_NOT_NEED = new Set(['staff.json', 'era-trends.json', 'company-progression.json']);

// Rules the game does not implement today, each with the decision that would resolve it. Listing
// them keeps the check useful: a new divergence fails, while these stay visible rather than silent.
const KNOWN_GAPS = {
  'reliability-model.json': 'the game has no faults, quality control or arrival defects; awaiting decision I1',
  'evaluation.json': 'the game shows raw values rather than the six scored dimensions; awaiting decision K',
};

function sourceFiles() {
  const src = fs.readFileSync(path.join(root, 'assets', 'scripts', 'domain', 'data.ts'), 'utf8');
  const start = src.indexOf('export const DATA');
  const provided = new Set([...src.slice(start).matchAll(/^  "([A-Za-z][A-Za-z0-9]*)":/gm)].map(m => m[1]));
  const hashes = {};
  const block = src.match(/"sourceHashes":\s*\{([\s\S]*?)\}/);
  if (block) for (const line of block[1].split('\n')) {
    const m = line.match(/"([^"]+)":\s*"([a-f0-9]+)"/);
    if (m) hashes[m[1]] = m[2];
  }
  return { provided, hashes };
}

function gameSource() {
  const parts = [];
  const walk = dir => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = dir + '/' + e.name;
      if (e.isDirectory()) walk(rel);
      else if (e.name.endsWith('.ts')) parts.push(fs.readFileSync(path.join(root, rel), 'utf8'));
    }
  };
  walk('assets/scripts');
  return parts.join('\n');
}

function run() {
  const { provided, hashes } = sourceFiles();
  const game = gameSource();

  // 1. The generated data has to be built from the design files as they are now.
  const stale = [];
  for (const [name, want] of Object.entries(hashes)) {
    const file = path.join(root, 'design', name);
    assert(fs.existsSync(file), `${name} is recorded as a source but does not exist`);
    const got = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (got !== want) stale.push(name);
  }
  assert.equal(stale.length, 0,
    `the generated game data was built from older design files: ${stale.join(', ')}. Run npm run prepare:demo`);

  // 2. Every key the game reads has to be one the generated data provides.
  const referenced = new Set([...game.matchAll(/DATA\.([A-Za-z][A-Za-z0-9]*)/g)].map(m => m[1]));
  const unmet = [...referenced].filter(k => !provided.has(k));
  assert.equal(unmet.length, 0,
    `the game reads DATA keys the generated data does not provide: ${unmet.join(', ')}`);

  // 3. A design file the game is meant to implement must be carried, or implemented visibly.
  const unimplemented = [];
  for (const [file, rule] of Object.entries(GAME_MUST_IMPLEMENT)) {
    if (DEMO_DOES_NOT_NEED.has(file)) continue;
    const carried = provided.has(file.replace('.json', '').replace('-model', ''));
    const implemented = rule.markers.some(m => new RegExp(m).test(game));
    if (!carried && !implemented) unimplemented.push(file + ' (' + rule.note + ')');
  }
  const known = unimplemented.filter(u => KNOWN_GAPS[u.split(' ')[0]]);
  const fresh = unimplemented.filter(u => !KNOWN_GAPS[u.split(' ')[0]]);
  assert.equal(fresh.length, 0,
    `${fresh.length} design rules are neither carried into the game nor implemented in it: ${fresh.join('; ')}`);

  const output = {
    status: known.length ? 'passed_with_known_gaps' : 'passed',
    sourceFilesHashed: Object.keys(hashes).length,
    keysProvided: [...provided].length,
    keysReferenced: [...referenced].length,
    designRulesTracked: Object.keys(GAME_MUST_IMPLEMENT).length,
    demoDoesNotNeed: [...DEMO_DOES_NOT_NEED],
    knownGaps: known.map(u => ({ rule: u.split(' ')[0], reason: KNOWN_GAPS[u.split(' ')[0]] })),
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'design-to-game-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
