// Validate the fifteen-year pacing model and tie its cadence claim back to the catalog it came from.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

const model = read('era-trends.json');
const CATALOG = ['cpu-motherboard.json', 'gpu.json', 'memory-storage.json', 'structural.json'];
const { FIRST_YEAR, LAST_YEAR } = require('./demo-facts.cjs');
// Both ends of the timeline come from the era model, so a change there is felt here.

function run() {
  assert.equal(model.schemaVersion, 1, 'schema');
  assert(model.status && model.provenance?.existing && model.provenance?.new && model.provenance?.limits, 'provenance');

  const levels = Object.keys(model.basisLevels || {});
  assert(levels.length >= 2, 'every value must carry an evidence level');

  // The confirmed timeline is covered exactly once, with no gaps.
  assert.equal(model.years.length, LAST_YEAR - FIRST_YEAR + 1, `expected ${LAST_YEAR - FIRST_YEAR + 1} years`);
  for (let i = 0; i < model.years.length; i++) {
    const y = model.years[i];
    assert.equal(y.year, FIRST_YEAR + i, `year ${y.year} is out of sequence`);
    assert(levels.includes(y.basis), `${y.year}: unknown basis ${y.basis}`);
    assert(y.era, `${y.year}: era name`);
    assert(Number.isFinite(y.demandIndex) && y.demandIndex > 0, `${y.year}: demand index`);
    assert(Number.isFinite(y.partsCostIndex) && y.partsCostIndex > 0, `${y.year}: parts cost index`);
  }

  // 2016 is the normalisation anchor and the only verified market year.
  const anchor = model.years[0];
  assert.equal(anchor.basis, 'verified_anchor', '2016 must be the verified anchor');
  assert.equal(anchor.demandIndex, 1, '2016 is the demand baseline');
  assert.equal(anchor.partsCostIndex, 1, '2016 is the cost baseline');
  assert(/market-reference/.test(anchor.note), 'the verified anchor must point at its recorded source');
  const verified = model.years.filter(y => y.basis === 'verified_anchor');
  assert.equal(verified.length, 1, 'exactly one year may claim verified market data');

  // A lead may never be presented as a fact.
  for (const y of model.years.filter(y => y.basis === 'lead'))
    assert(/线索|未能打开|仅作/.test(y.note), `${y.year}: a lead must say it is unverified`);

  // The cadence claim must match what the catalog actually contains.
  let events = 0, minMonth = null, maxMonth = null;
  for (const file of CATALOG) {
    const doc = read(path.join('catalog-2016-2020', file));
    for (const event of doc.events || []) {
      events++;
      if (!minMonth || event.month < minMonth) minMonth = event.month;
      if (!maxMonth || event.month > maxMonth) maxMonth = event.month;
    }
  }
  assert.equal(model.cadence.totalEvents, events, `cadence claims ${model.cadence.totalEvents} events, the catalog holds ${events}`);
  assert.equal(model.cadence.observedWindow, `${minMonth} to ${maxMonth}`, 'cadence window must match the catalog');

  // The observed rhythm must actually imply the claimed spacing.
  const launches = [];
  for (const file of CATALOG) {
    const doc = read(path.join('catalog-2016-2020', file));
    for (const event of doc.events || []) if (/platform_launch|cpu_launch/.test(event.type)) launches.push(event.month);
  }
  launches.sort();
  assert.equal(model.cadence.generationLaunches, launches.length,
    `cadence claims ${model.cadence.generationLaunches} generation launches, the catalog holds ${launches.length}`);
  const observedYears = model.cadence.observedYears;
  assert.equal(observedYears, Number(maxMonth.slice(0, 4)) - Number(minMonth.slice(0, 4)) + 1, 'observed year count');
  assert.equal(model.cadence.eventsPerYear, Number((events / observedYears).toFixed(1)), 'events per year must follow from the catalog');
  assert.equal(model.cadence.generationLaunchesPerYear, Number((launches.length / observedYears).toFixed(1)), 'generation launches per year must follow from the catalog');
  const spanMonths = (Number(maxMonth.slice(0, 4)) - Number(minMonth.slice(0, 4))) * 12 + (Number(maxMonth.slice(5)) - Number(minMonth.slice(5)));
  const perYear = launches.length / (spanMonths / 12);

  assert(Array.isArray(model.gaps) && model.gaps.length, 'unverified areas must be recorded as gaps');
  for (const gap of model.gaps) assert(gap.subject && gap.missingEvidence && gap.gameResolution, 'each gap needs a subject, the missing evidence and the game resolution');

  const output = {
    status: 'passed',
    years: model.years.length,
    window: `${model.years[0].year}-${model.years.at(-1).year}`,
    basisCounts: model.years.reduce((a, y) => (a[y.basis] = (a[y.basis] || 0) + 1, a), {}),
    catalogEvents: events,
    generationLaunches: launches.length,
    catalogWindow: `${minMonth} to ${maxMonth}`,
    generationLaunchesPerYear: model.cadence.generationLaunchesPerYear,
    demandRange: [Math.min(...model.years.map(y => y.demandIndex)), Math.max(...model.years.map(y => y.demandIndex))],
    partsCostRange: [Math.min(...model.years.map(y => y.partsCostIndex)), Math.max(...model.years.map(y => y.partsCostIndex))],
    gaps: model.gaps.length,
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'era-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
