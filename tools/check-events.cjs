// Validate the scheduled market event and prove every outcome keeps the Demo playable.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

// Regenerate the simulation first so this can never validate a stale result file.
require('node:child_process').execFileSync(process.execPath, [path.join(__dirname, 'simulate-economy.cjs')], { stdio: 'ignore' });

const events = read('market-events.json');
const economy = read('economy-candidate.json');
const results = read('economy-review-results.json').results;
const { DEMO_MONTHS } = require('./demo-facts.cjs');

function run() {
  assert.equal(events.schemaVersion, 1, 'schema');
  assert(events.status && events.provenance?.existing && events.provenance?.new && events.provenance?.limits, 'provenance');
  assert(events.rules?.omenLeadsResolutionByMonths >= 1, 'an omen must lead its resolution');
  assert.equal(new Set(events.events.map(e => e.id)).size, events.events.length, 'duplicate event id');

  const findings = [];
  for (const event of events.events) {
    assert(event.zh && event.omen, `${event.id}: name and omen`);
    assert(Array.isArray(event.affectedCategories) && event.affectedCategories.length, `${event.id}: affected categories`);
    assert(Number.isInteger(event.omenMonth) && Number.isInteger(event.resolveMonth) && Number.isInteger(event.throughMonth),
      `${event.id}: month fields`);
    assert(event.omenMonth >= 1 && event.omenMonth < event.resolveMonth, `${event.id}: the omen must come before the result`);
    assert(event.resolveMonth <= event.throughMonth && event.throughMonth <= DEMO_MONTHS,
      `${event.id}: the event must finish inside the ${DEMO_MONTHS}-month Demo`);

    const weight = event.outcomes.reduce((n, o) => n + o.weight, 0);
    assert.equal(weight, 100, `${event.id}: outcome weights must total 100, got ${weight}`);
    assert(event.outcomes.length >= 2, `${event.id}: an uncertain event needs more than one outcome`);
    assert(new Set(event.outcomes.map(o => o.id)).size === event.outcomes.length, `${event.id}: duplicate outcome id`);

    for (const outcome of event.outcomes) {
      const scenario = economy.scenarios[outcome.scenarioId];
      assert(scenario, `${event.id}/${outcome.id}: unknown scenario ${outcome.scenarioId}`);
      assert.equal(scenario.fromMonth, event.resolveMonth, `${event.id}/${outcome.id}: scenario must start when the event resolves`);
      assert.equal(scenario.throughMonth, event.throughMonth, `${event.id}/${outcome.id}: scenario must end with the event`);
      const named = Object.keys(scenario.categoryMultipliers || {}).sort();
      assert.deepEqual(named, [...event.affectedCategories].sort(),
        `${event.id}/${outcome.id}: scenario categories ${named} do not match the event's ${event.affectedCategories}`);
      for (const cat of event.affectedCategories) {
        assert.equal(scenario.categoryMultipliers[cat], outcome.categoryMultiplier,
          `${event.id}/${outcome.id}: scenario factor for ${cat} differs from the outcome`);
      }
      assert(outcome.categoryMultiplier >= 1, `${event.id}/${outcome.id}: a supply event cannot lower prices`);
      assert(outcome.feedback, `${event.id}/${outcome.id}: player feedback`);

      // Every outcome must stay playable and must not overturn the confirmed route relationship.
      const normal = {};
      for (const route of Object.keys(economy.routes)) {
        const row = results.find(x => x.difficulty === 'normal' && x.route === route && x.scenario === outcome.scenarioId);
        assert(row, `${event.id}/${outcome.id}: missing result for ${route}`);
        assert(row.operatingProfit > 0, `${event.id}/${outcome.id}: ${route} loses money (${row.operatingProfit})`);
        assert(!row.bankrupt, `${event.id}/${outcome.id}: ${route} goes bankrupt`);
        normal[route] = row.operatingProfit;
      }
      const sum = normal.boutique + normal.scale;
      assert(normal.mixed > normal.boutique && normal.mixed > normal.scale,
        `${event.id}/${outcome.id}: the mixed route is no longer the strongest`);
      assert(normal.mixed < sum, `${event.id}/${outcome.id}: the mixed route must stay below boutique plus scale`);
      findings.push({
        event: event.id, outcome: outcome.id, zh: outcome.zh, weight: outcome.weight,
        categoryMultiplier: outcome.categoryMultiplier, scenarioId: outcome.scenarioId,
        boutique: normal.boutique, scale: normal.scale, mixed: normal.mixed,
        boutiqueVsScale: normal.boutique < normal.scale,
      });
    }
  }

  const baseline = {};
  for (const route of Object.keys(economy.routes))
    baseline[route] = results.find(x => x.difficulty === 'normal' && x.route === route && x.scenario === 'baseline').operatingProfit;

  const output = {
    status: 'passed',
    scheduledEvents: events.events.length,
    demoMonths: DEMO_MONTHS,
    baseline,
    outcomes: findings.map(f => ({
      ...f,
      scaleVsBaseline: Number(((f.scale / baseline.scale - 1) * 100).toFixed(1)),
      boutiqueVsBaseline: Number(((f.boutique / baseline.boutique - 1) * 100).toFixed(1)),
      mixedVsBaseline: Number(((f.mixed / baseline.mixed - 1) * 100).toFixed(1)),
    })),
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'event-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
