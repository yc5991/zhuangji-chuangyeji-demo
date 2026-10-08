// Verify the completion audit's own claims: evidence exists, checks are registered, gaps name their blocker.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

const audit = read('completion-audit.json');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const scripts = pkg.scripts || {};
const STATES = ['complete', 'pending_decision', 'pending_external'];

function run() {
  assert.equal(audit.schemaVersion, 1, 'schema');
  assert(audit.objective && audit.method, 'the audit must state its objective and method');
  assert(Array.isArray(audit.areas) && audit.areas.length, 'areas');

  const seen = new Set();
  for (const area of audit.areas) {
    assert(area.id && area.zh && area.state, `${area.id || '?'}: id, name and state`);
    assert(!seen.has(area.id), `duplicate area ${area.id}`);
    seen.add(area.id);
    assert(STATES.includes(area.state), `${area.id}: unknown state ${area.state}`);

    if (area.state === 'complete') {
      // A claim of completion must point at files that exist and a check that is wired up.
      assert(area.files?.length, `${area.id} claims completion with no evidence file`);
      for (const f of area.files)
        assert(fs.existsSync(path.join(root, f)), `${area.id}: evidence file ${f} does not exist`);
      assert(area.checker, `${area.id} claims completion with no check`);
      assert(scripts[area.checker], `${area.id}: ${area.checker} is not a registered npm script`);
      const target = scripts[area.checker].replace(/^node\s+/, '').split(/\s+/)[0];
      assert(fs.existsSync(path.join(root, target)), `${area.id}: ${area.checker} points at a missing file ${target}`);
    } else {
      // Anything unfinished must say what blocks it and who decides, never just be listed.
      assert(area.blockedBy, `${area.id} is ${area.state} but does not say what blocks it`);
      assert(area.decidedBy, `${area.id} is ${area.state} but does not say who decides`);
      assert(!area.checker, `${area.id} is unfinished yet claims a passing check`);
    }
  }

  for (const item of audit.outOfScope || []) {
    assert(item.id && item.zh && item.reason, 'every out-of-scope item needs a reason');
  }

  const counts = audit.areas.reduce((a, x) => (a[x.state] = (a[x.state] || 0) + 1, a), {});
  for (const s of STATES) counts[s] ||= 0;
  assert.equal(counts.complete + counts.pending_decision + counts.pending_external, audit.areas.length, 'every area is classified');

  // The audit must not claim the objective is finished while decisions are outstanding.
  const finished = counts.pending_decision === 0 && counts.pending_external === 0;
  const output = {
    status: finished ? 'complete' : 'in_progress',
    areas: audit.areas.length,
    counts,
    outOfScope: (audit.outOfScope || []).length,
    completeChecks: audit.areas.filter(a => a.state === 'complete').map(a => a.checker).sort(),
    awaitingDecision: audit.areas.filter(a => a.state === 'pending_decision').map(a => a.zh),
    awaitingInput: audit.areas.filter(a => a.state === 'pending_external').map(a => a.zh),
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'audit-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
