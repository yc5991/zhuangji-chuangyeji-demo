// Dates and months across the design data must agree on when the Demo runs and what is available.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

// Compare YYYY-MM and YYYY-MM-DD on one scale: days since year zero, roughly.
const toDays = s => {
  const m = String(s).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) throw new Error('Unparseable date: ' + s);
  return Number(m[1]) * 372 + Number(m[2]) * 31 + Number(m[3] || 1);
};
const monthEnd = s => { const m = String(s).match(/^(\d{4})-(\d{2})/); return m[1] + '-' + m[2] + '-31'; };

const DEMO_FIRST = '2016-01', DEMO_LAST = '2016-06';
const TIMELINE_FIRST = 2016, TIMELINE_LAST = 2030;

function run() {
  const schedule = read('demo-schedule.json');
  const workbench = read('workbench.json');
  const events = read('market-events.json');
  const era = read('era-trends.json');
  const progression = read('company-progression.json');
  const components = read('components.json');
  const balance = read('balance.json');
  const catalog = ['cpu-motherboard.json', 'gpu.json', 'memory-storage.json', 'structural.json']
    .flatMap(f => read(path.join('catalog-2016-2020', f)).events || []);

  const findings = [];

  // The Demo covers six consecutive months starting at the confirmed window.
  assert.equal(schedule.months.length, 6, 'the Demo is six months');
  schedule.months.forEach((m, i) => assert.equal(m.month, i + 1, 'Demo months run 1 to 6'));

  // Every Demo-relative month must fall inside the window.
  const monthToDate = n => `2016-${String(n).padStart(2, '0')}`;
  for (const event of events.events) {
    for (const [field, value] of [['omenMonth', event.omenMonth], ['resolveMonth', event.resolveMonth], ['throughMonth', event.throughMonth]]) {
      assert(value >= 1 && value <= 6, `${event.id}.${field} is month ${value}, outside the Demo`);
      const date = monthToDate(value);
      assert(toDays(date) >= toDays(DEMO_FIRST) && toDays(monthEnd(date)) <= toDays(monthEnd(DEMO_LAST)),
        `${event.id}.${field} maps to ${date}, outside ${DEMO_FIRST} to ${DEMO_LAST}`);
    }
  }

  // Every dated workbench event must land inside the Demo.
  for (const e of workbench.eventDates) {
    assert(toDays(e.date) >= toDays(DEMO_FIRST), `workbench event ${e.date} precedes the Demo`);
    assert(toDays(e.date) <= toDays(monthEnd(DEMO_LAST)), `workbench event ${e.date} falls after the Demo ends`);
    assert(e.dateBasis, `workbench event ${e.date} has no date basis, so it cannot be distinguished from a guess`);
  }

  // The full-game timeline must start on the Demo's year and be contiguous.
  assert.equal(era.years[0].year, TIMELINE_FIRST, 'the era model must start on the Demo year');
  assert.equal(era.years.at(-1).year, TIMELINE_LAST, 'the era model must reach the end of the timeline');
  era.years.forEach((y, i) => assert.equal(y.year, TIMELINE_FIRST + i, `era year ${y.year} is out of sequence`));

  // The first workshop tier must be the one the Demo opens in.
  const firstTier = progression.tiers[0];
  assert.equal(firstTier.fromYear, TIMELINE_FIRST, 'the first tier must open in the Demo year');
  const tierYears = progression.tiers.map(t => t.fromYear);
  for (const year of tierYears) assert(year >= TIMELINE_FIRST && year <= TIMELINE_LAST, `tier year ${year} is outside the timeline`);

  // A recipe may only name parts that exist by the time it is first sold.
  for (const recipe of balance.recipes) {
    const ids = [];
    for (const key of ['cpu', 'motherboard', 'gpu', 'psu', 'cooler', 'case'])
      if (recipe[key]) ids.push(typeof recipe[key] === 'string' ? recipe[key] : recipe[key].id);
    for (const key of ['ram', 'storage']) for (const e of recipe[key] || []) ids.push(e.id);
    let latest = null, latestPart = null;
    for (const id of ids) {
      const part = components.parts.find(p => p.id === id);
      assert(part, `recipe ${recipe.id} names unknown part ${id}`);
      const date = part.availability?.gameDate;
      if (date && (!latest || toDays(date) > toDays(latest))) { latest = date; latestPart = id; }
    }
    // The Demo's first build happens in month one, so a part arriving later changes when the model can be made.
    const availableAtStart = !latest || toDays(latest) <= toDays(monthEnd(DEMO_FIRST));
    findings.push({ recipe: recipe.id, latestPart, latestDate: latest, availableFromMonthOne: availableAtStart });
    if (!availableAtStart) findings.at(-1).note = `${latestPart} arrives ${latest}, after the Demo opens`;
  }

  // The catalog must begin with the Demo and its events must carry a month.
  const months = catalog.map(e => e.month).sort();
  assert.equal(months[0], DEMO_FIRST, `the catalog starts at ${months[0]}, the Demo starts at ${DEMO_FIRST}`);
  for (const e of catalog) assert(/^\d{4}-\d{2}$/.test(e.month), `catalog event ${e.month} is not a month`);

  const output = {
    status: 'passed',
    demoWindow: `${DEMO_FIRST} to ${DEMO_LAST}`,
    timeline: `${TIMELINE_FIRST}-${TIMELINE_LAST}`,
    workbenchEvents: workbench.eventDates.map(e => ({ date: e.date, basis: e.dateBasis })),
    catalogWindow: `${months[0]} to ${months.at(-1)}`,
    catalogEvents: catalog.length,
    recipes: findings,
    gaps: [{
      subject: '2021-2030 的硬件目录',
      detail: `目录覆盖到 ${months.at(-1)}，年代模型与成长阶梯延伸到 ${TIMELINE_LAST}，中间 10 年没有配件数据`,
    }],
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'temporal-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
