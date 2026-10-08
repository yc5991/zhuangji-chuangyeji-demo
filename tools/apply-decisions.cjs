// Land the six confirmed design decisions in one atomic step, then re-check everything.
//
//   node tools/apply-decisions.cjs            show what would change (no writes)
//   node tools/apply-decisions.cjs --apply    write the data and re-run every check
//
// Every decision below is one the design review settled; the reasoning and the measurements
// behind each are recorded in docs/decisions.md.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

const DECISIONS = {
  // Decision 1. Raising the commission hours is what puts boutique under a real constraint
  // instead of a plan ceiling. With them, boutique is limited by the premium commission.
  hours: { quiet_office: { designHours: 14, assemblyHours: 20 }, premium: { designHours: 32, assemblyHours: 45 } },
  // Decision 2. Every price moves halfway to its measured optimum, and the two commission
  // ceilings widen so a month with a single interested customer cannot round them away.
  prices: { office: 2202, gaming: 4743, quiet_office: 5391, premium: 11724 },
  demandCaps: { quiet_office: [3, 3, 4, 5, 6, 6], premium: [1, 3, 3, 3, 3, 4] },
  // Decision 1 continued. Mixed plans a third more and buys its bench in month five, so the
  // month-five investment promise holds for it as well as for the mass route.
  mixedPlanFactor: 1.3,
  mixedInvestments: [{ month: 3, id: 'craft_tools' }, { month: 5, id: 'bench' }],
  mixedHires: [5],
  // Decision 3 is a rule rather than a number: hard mode unlocks the other routes on five
  // delivered commissions, which the current numbers reach at the end of month four.
  // Decision 4 is withdrawn: growing the pool from reputation above one breaks the rule that
  // mixed earns most, so reputation above one stays a buffer.
  // Decision 5 is unchanged: hiring still does not pay at the demo's demand, which is recorded
  // as a deliberate fact rather than an oversight.
  // Decision 6 is a wording change to the schedule, applied to demo-schedule.json.
  scheduleNote: '第 5 月的投资机会适用于量产与混合；困难档精品的第 5—6 月选择是是否招人',
};

function planned() {
  const economy = read('economy-candidate.json');
  const changes = [];
  for (const [id, hours] of Object.entries(DECISIONS.hours))
    for (const [field, value] of Object.entries(hours))
      if (economy.products[id][field] !== value)
        changes.push({ where: 'products.' + id + '.' + field, from: economy.products[id][field], to: value });
  for (const [id, price] of Object.entries(DECISIONS.prices))
    if (economy.products[id].salePrice !== price)
      changes.push({ where: 'products.' + id + '.salePrice', from: economy.products[id].salePrice, to: price });
  for (const [id, caps] of Object.entries(DECISIONS.demandCaps))
    if (JSON.stringify(economy.companyDemandCaps[id]) !== JSON.stringify(caps))
      changes.push({ where: 'companyDemandCaps.' + id, from: economy.companyDemandCaps[id], to: caps });
  const mixed = economy.routes.mixed;
  const grown = mixed.monthlyProductionTargets.map(t =>
    Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Math.round(v * DECISIONS.mixedPlanFactor)])));
  if (JSON.stringify(mixed.monthlyProductionTargets) !== JSON.stringify(grown))
    changes.push({ where: 'routes.mixed.monthlyProductionTargets', from: mixed.monthlyProductionTargets, to: grown });
  if (JSON.stringify(mixed.investments) !== JSON.stringify(DECISIONS.mixedInvestments))
    changes.push({ where: 'routes.mixed.investments', from: mixed.investments, to: DECISIONS.mixedInvestments });
  if (JSON.stringify(mixed.hires) !== JSON.stringify(DECISIONS.mixedHires))
    changes.push({ where: 'routes.mixed.hires', from: mixed.hires, to: DECISIONS.mixedHires });
  return { economy, changes, grown };
}

function apply() {
  const { economy, changes, grown } = planned();
  if (!changes.length) { console.log('already applied; nothing to change'); return { changes: [] }; }
  for (const [id, hours] of Object.entries(DECISIONS.hours)) Object.assign(economy.products[id], hours);
  for (const [id, price] of Object.entries(DECISIONS.prices)) economy.products[id].salePrice = price;
  for (const [id, caps] of Object.entries(DECISIONS.demandCaps)) economy.companyDemandCaps[id] = caps;
  economy.routes.mixed.monthlyProductionTargets = grown;
  economy.routes.mixed.investments = DECISIONS.mixedInvestments;
  economy.routes.mixed.hires = DECISIONS.mixedHires;
  fs.writeFileSync(path.join(root, 'design', 'economy-candidate.json'), JSON.stringify(economy, null, 2) + '\n');

  // Rewrite the recorded hiring facts, since the decisions change them deliberately.
  const factsPath = path.join(root, 'design', 'recorded-facts.json');
  if (fs.existsSync(factsPath)) {
    const { simulate, config } = require('./simulate-economy.cjs');
    const facts = JSON.parse(fs.readFileSync(factsPath, 'utf8'));
    // The best single month to hire, not the first: hiring late avoids paying a wage for months
    // with nothing to do, which is how the mixed route makes a profit on it.
    const normal = {};
    for (const route of Object.keys(config.routes)) {
      const before = simulate(route, 'baseline', 'normal');
      if (before.gatedAtStart) continue;
      const saved = config.routes[route].hires;
      let best = null;
      for (let month = 1; month <= 6; month++) {
        config.routes[route].hires = [month];
        const delta = Math.round(simulate(route, 'baseline', 'normal').operatingProfit - before.operatingProfit);
        if (best === null || delta > best) best = delta;
      }
      config.routes[route].hires = saved;
      normal[route] = best;
    }
    const hardBefore = simulate('boutique', 'baseline', 'hard');
    const savedHires = config.routes.boutique.hires;
    config.routes.boutique.hires = [6];
    const hardLate = Math.round(simulate('boutique', 'baseline', 'hard').operatingProfit - hardBefore.operatingProfit);
    config.routes.boutique.hires = savedHires;
    facts.hireEffectNormalDifficulty.values = normal;
    facts.hireEffectHardModeLateHire.value = hardLate;
    fs.writeFileSync(factsPath, JSON.stringify(facts, null, 2) + '\n');
    console.log('recorded hiring facts updated: ' + JSON.stringify(normal) + ' late ' + hardLate);
  }

  const schedulePath = path.join(root, 'design', 'demo-schedule.json');
  const schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
  const may = schedule.months.find(m => m.month === 5);
  if (may && !may.scopeNote) {
    may.scopeNote = DECISIONS.scheduleNote;
    fs.writeFileSync(schedulePath, JSON.stringify(schedule, null, 2) + '\n');
  }
  return { changes };
}

const CHECKS = ['design','suppliers','customers','events','reliability','investments','era','fullgame',
  'schedule','difficulty','evaluation','flow','progression','staff','case-options','cable-routing',
  'export-coverage','references','temporal','reachability','coverage','seams','wiring',
  'doc-figures','single-source','audit'];

function main() {
  const write = process.argv.includes('--apply');
  const { changes } = write ? apply() : planned();
  console.log(write ? 'applied ' + changes.length + ' change(s)' : 'would apply ' + changes.length + ' change(s)');
  for (const c of changes) console.log('  ' + c.where + ': ' + JSON.stringify(c.from) + ' -> ' + JSON.stringify(c.to));
  if (!write || !changes.length) {
    if (!write) console.log('\nrun with --apply to write, then the checks and the baseline follow');
    return;
  }
  // The figures the documents quote are the ones the old data produced, so refresh them now.
  const { repair } = require('./check-doc-figures.cjs');
  const refreshed = repair();
  if (refreshed.length) {
    console.log('refreshed ' + refreshed.length + ' document figure(s):');
    for (const line of refreshed) console.log('  ' + line);
  }

  console.log('\nre-running every check');
  const failed = [];
  for (const name of CHECKS) {
    try {
      execFileSync('npm', ['run', 'check:' + name, '--silent'], { cwd: root, stdio: 'pipe', shell: true });
    } catch { failed.push(name); }
  }
  console.log('  ' + (CHECKS.length - failed.length) + ' of ' + CHECKS.length + ' passed');
  if (failed.length) {
    console.log('  FAILED: ' + failed.join(', '));
    console.log('\nThe checks did not all pass, so the baseline was NOT updated.');
    process.exitCode = 1;
    return;
  }
  console.log('\nupdating the regression baseline');
  execFileSync('node', ['tools/balance-baseline.cjs', 'update'], { cwd: root, stdio: 'inherit' });
  console.log('done');
}

if (require.main === module) main();
module.exports = { DECISIONS, planned, apply, CHECKS };
