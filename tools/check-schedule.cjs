// Check the Demo content schedule against spec section 7 and the data files that carry the months.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

const schedule = read('demo-schedule.json');
const economy = read('economy-candidate.json');
const events = read('market-events.json');
const { DEMO_MONTHS } = require('./demo-facts.cjs');

// The spec fixes which months each phase covers.
const PHASE_WINDOWS = { '7.1': [1, 2], '7.2': [3, 4], '7.3': [5, 6] };

function run() {
  assert.equal(schedule.schemaVersion, 1, 'schema');
  assert(schedule.status && schedule.provenance?.existing && schedule.provenance?.new && schedule.provenance?.limits, 'provenance');

  assert.equal(schedule.months.length, DEMO_MONTHS, `the Demo is ${DEMO_MONTHS} months`);
  for (let i = 0; i < schedule.months.length; i++) {
    const m = schedule.months[i];
    assert.equal(m.month, i + 1, `month ${m.month} is out of sequence`);
    const window = PHASE_WINDOWS[m.phase];
    assert(window, `${m.month}: unknown phase ${m.phase}`);
    assert(m.month >= window[0] && m.month <= window[1],
      `month ${m.month} is labelled ${m.phase} but that phase covers months ${window[0]}-${window[1]}`);
    assert(m.zh && Array.isArray(m.content) && m.content.length, `${m.month}: name and content`);
    assert(Array.isArray(m.teaching) && Array.isArray(m.unlocks), `${m.month}: teaching and unlock lists`);
    for (const t of m.teaching) assert(schedule.teachingSubjectZh[t], `${m.month}: unknown teaching subject ${t}`);
  }

  // Section 7.1 lists five teaching subjects and puts them all in months 1-2.
  const taught = {};
  for (const m of schedule.months) for (const t of m.teaching) (taught[t] ||= []).push(m.month);
  for (const subject of schedule.teachingSubjects) {
    assert(taught[subject], `teaching subject ${subject} is never introduced`);
    for (const month of taught[subject])
      assert(month <= 2, `${subject} is taught in month ${month}, outside the 7.1 teaching window`);
  }
  assert.equal(Object.keys(taught).length, schedule.teachingSubjects.length, 'an unlisted subject is taught');

  // "After the basic teaching the player may choose their own direction."
  const early = schedule.months.filter(m => m.month <= 2);
  assert(early.every(m => m.freeChoice === false || m.freeChoice === true), 'free choice flag');
  assert(schedule.months[1].content.some(c => /自主决定产品方向/.test(c)), 'the teaching must hand over direction after month two');
  assert(schedule.months.filter(m => m.month > 2).every(m => m.freeChoice === true), 'every month after teaching is free');

  // Section 7.2 puts the market change in months 3-4.
  for (const event of events.events) {
    assert(event.omenMonth >= 3 && event.omenMonth <= 4, `${event.id}: the omen must land in months 3-4`);
    assert(event.resolveMonth >= 3 && event.resolveMonth <= 4, `${event.id}: the result must land in months 3-4`);
    const omenMonth = schedule.months[event.omenMonth - 1];
    assert(omenMonth.phase === '7.2', `${event.id}: month ${event.omenMonth} is not in phase 7.2`);
    assert(omenMonth.content.some(c => /预兆/.test(c)), `${event.id}: the omen month must mention the omen`);
  }

  // Section 7.3 expects an investment opportunity in months 5-6 that both routes show value from.
  const lateInvestments = {};
  for (const [routeId, route] of Object.entries(economy.routes)) {
    if (!economy.opening.normal.startingRoutes.includes(routeId)) continue;
    lateInvestments[routeId] = route.investments.filter(p => p.month >= 5 && p.month <= 6).map(p => p.id);
  }
  const withoutLate = Object.entries(lateInvestments).filter(([, ids]) => !ids.length).map(([r]) => r);
  const unlockMonth = schedule.months.find(m => m.unlocks.includes('development_investment'));
  assert(unlockMonth, 'the development investment must unlock in a month');
  assert(unlockMonth.month >= 5 && unlockMonth.month <= 6,
    `the investment opportunity unlocks in month ${unlockMonth.month}, outside the 7.3 window`);

  // Section 7 closing paragraph.
  const EXPECTED_SUMMARY = ['sales', 'representative_work', 'customer_reputation', 'capacity', 'business_direction'];
  assert.deepEqual([...schedule.summaryFields].sort(), [...EXPECTED_SUMMARY].sort(), 'summary fields must match the spec list');
  for (const f of schedule.summaryFields) assert(schedule.summaryFieldsZh[f], `summary field ${f} needs a Chinese label`);

  // Anything the spec asks for that the data cannot yet satisfy must be written down, not hidden.
  for (const gap of schedule.openGaps || [])
    assert(gap.subject && gap.detail && gap.blockedBy, 'each open gap needs a subject, detail and what blocks it');
  if (withoutLate.length)
    assert((schedule.openGaps || []).some(g => withoutLate.every(r => g.subject.includes(r === 'boutique' ? '精品' : r === 'mixed' ? '混合' : r))),
      `${withoutLate.join(', ')} have no month 5-6 investment, which must be recorded as an open gap`);

  const output = {
    status: 'passed',
    months: schedule.months.length,
    phases: Object.fromEntries(Object.entries(PHASE_WINDOWS).map(([p, w]) => [p, w])),
    teachingCovered: Object.keys(taught).length,
    teachingSubjects: schedule.teachingSubjects.length,
    lateInvestments,
    routesWithoutLateInvestment: withoutLate,
    summaryFields: schedule.summaryFields.length,
    openGaps: (schedule.openGaps || []).length,
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'schedule-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
