// The progression ladder must start exactly at the confirmed demo opening and stay reachable.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { simulate, config } = require('./simulate-economy.cjs');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

const progression = read('company-progression.json');
const economy = read('economy-candidate.json');
const era = read('era-trends.json');
const FIRST_YEAR = 2016, LAST_YEAR = 2030;

function run() {
  assert.equal(progression.schemaVersion, 1, 'schema');
  assert(progression.status && progression.provenance?.existing && progression.provenance?.new && progression.provenance?.limits, 'provenance');
  const tiers = progression.tiers;
  assert(tiers.length >= 2, 'a progression needs more than one tier');

  // Ordered, contiguous and inside the confirmed timeline.
  tiers.forEach((t, i) => {
    assert.equal(t.order, i + 1, `${t.id}: order must match position`);
    assert(t.zh && t.note, `${t.id}: name and note`);
    assert(t.fromYear >= FIRST_YEAR && t.fromYear <= LAST_YEAR, `${t.id}: fromYear outside the timeline`);
    if (i) assert(t.fromYear > tiers[i - 1].fromYear, `${t.id}: must open after ${tiers[i - 1].id}`);
  });
  assert.equal(tiers[0].fromYear, FIRST_YEAR, 'the first tier must open in the first year');

  // Every later tier must be strictly better, or moving is never worth it.
  for (let i = 1; i < tiers.length; i++) {
    const a = tiers[i - 1], b = tiers[i];
    for (const key of ['maxBenches', 'maxEmployees', 'maxTestStations', 'monthlyRent', 'monthlyUtilities', 'moveCost'])
      assert(b[key] > a[key], `${b.id}: ${key} ${b[key]} does not exceed ${a.id}'s ${a[key]}`);
  }

  // The demo must start on the first tier, or the two do not share a workshop.
  const opening = economy.opening.normal;
  const first = tiers[0];
  assert.equal(first.monthlyRent, opening.rent, `tier one rent ${first.monthlyRent} does not match the confirmed opening ${opening.rent}`);
  assert.equal(first.monthlyUtilities, opening.utilities, `tier one utilities ${first.monthlyUtilities} do not match the confirmed opening ${opening.utilities}`);
  assert(first.maxBenches >= opening.benches, 'tier one must allow at least the opening bench count');
  assert(first.maxEmployees >= opening.employees, 'tier one must allow at least the opening headcount');

  // Quarterly settlement is a later-stage option, never available from the start.
  const q = progression.quarterly;
  const unlock = tiers.find(t => t.id === q.unlocksAtTier);
  assert(unlock, `quarterly settlement names an unknown tier ${q.unlocksAtTier}`);
  assert(unlock.order > 1, 'quarterly settlement must not be available on the first tier');
  assert(q.monthsPerSettlement >= 2 && q.monthsPerSettlement <= 6, 'a settlement period of one is not a faster mode');
  assert(q.reason && q.keepsMonthlyOption, 'quarterly settlement needs its reason and the monthly option');

  // Each move must be affordable from profit accumulated since the previous move.
  const monthly = {};
  for (const y of era.years) {
    const profit = simulate('mixed', 'baseline', 'normal', {
      scenario: { demandMultiplier: y.demandIndex, partsPriceMultiplier: y.partsCostIndex, priceIndex: y.priceIndex },
    }).operatingProfit;
    monthly[y.year] = profit / 6; // the model runs six months
  }
  const reach = [];
  let sinceLastMove = 0, lastMoveYear = FIRST_YEAR;
  for (const tier of tiers) {
    if (tier.order === 1) continue;
    sinceLastMove = 0;
    for (let y = lastMoveYear; y < tier.fromYear; y++) sinceLastMove += monthly[y] * 12;
    const ratio = sinceLastMove / tier.moveCost;
    assert(ratio >= 1,
      `${tier.id} costs ${tier.moveCost} but only ${Math.round(sinceLastMove)} accumulates between moves`);
    reach.push({ tier: tier.id, moveCost: tier.moveCost, accumulated: Math.round(sinceLastMove), cover: Number(ratio.toFixed(2)) });
    lastMoveYear = tier.fromYear;
  }

  const output = {
    status: 'passed',
    tiers: tiers.map(t => ({ order: t.order, zh: t.zh, fromYear: t.fromYear, maxBenches: t.maxBenches, maxEmployees: t.maxEmployees, monthlyRent: t.monthlyRent, moveCost: t.moveCost })),
    quarterlyUnlocksAt: q.unlocksAtTier,
    monthsPerSettlement: q.monthsPerSettlement,
    reachability: reach,
    monthlyProfitByYear: { first: Math.round(monthly[FIRST_YEAR]), last: Math.round(monthly[LAST_YEAR]) },
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'progression-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
