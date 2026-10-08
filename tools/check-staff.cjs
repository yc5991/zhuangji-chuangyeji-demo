// Staff grades must be internally consistent and must reproduce the confirmed employee exactly.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { simulate, config } = require('./simulate-economy.cjs');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

const staff = read('staff.json');
const economy = read('economy-candidate.json');

function run() {
  assert.equal(staff.schemaVersion, 1, 'schema');
  assert(staff.status && staff.provenance?.existing && staff.provenance?.new && staff.provenance?.limits, 'provenance');
  const grades = staff.grades;
  assert(grades.length >= 2, 'a grade system needs more than one grade');

  grades.forEach((g, i) => {
    assert.equal(g.order, i + 1, `${g.id}: order must match position`);
    assert(g.zh && g.note, `${g.id}: name and note`);
    for (const key of ['monthlySalary', 'monthlyLaborHours', 'assemblyHourMultiplier', 'failureRateMultiplier', 'recruitmentCost', 'trainingCost'])
      assert(Number.isFinite(g[key]), `${g.id}: ${key} must be a number`);
    assert(g.assemblyHourMultiplier > 0 && g.failureRateMultiplier > 0, `${g.id}: multipliers must be positive`);
  });

  // The documented base grade has to be the one the economy already uses, or this is a rebalance.
  const base = grades.find(g => g.id === staff.rules.baseGradeId) || grades[1];
  assert.equal(base.monthlySalary, economy.employee.monthlySalary,
    `base grade salary ${base.monthlySalary} does not match the confirmed ${economy.employee.monthlySalary}`);
  assert.equal(base.monthlyLaborHours, economy.employee.monthlyLaborHours,
    `base grade hours ${base.monthlyLaborHours} do not match the confirmed ${economy.employee.monthlyLaborHours}`);
  assert.equal(base.recruitmentCost, economy.employee.recruitmentCost,
    `base grade recruitment ${base.recruitmentCost} does not match the confirmed ${economy.employee.recruitmentCost}`);
  assert.equal(base.assemblyHourMultiplier, 1, 'the base grade must be the reference for assembly time');
  assert.equal(base.failureRateMultiplier, 1, 'the base grade must be the reference for defects');

  // A higher grade must never be worse, or nobody would ever train one.
  for (let i = 1; i < grades.length; i++) {
    const a = grades[i - 1], b = grades[i];
    assert(b.monthlySalary > a.monthlySalary, `${b.id}: salary does not exceed ${a.id}`);
    assert(b.assemblyHourMultiplier < a.assemblyHourMultiplier, `${b.id}: does not assemble faster than ${a.id}`);
    assert(b.failureRateMultiplier < a.failureRateMultiplier, `${b.id}: does not produce fewer defects than ${a.id}`);
    assert(b.trainingCost > 0, `${b.id}: training must cost something`);
  }
  assert(staff.rules.trainingUpgradesInPlace && staff.rules.gradeAffectsQuality, 'rules');

  // Grade multipliers must actually reach the simulator, or the model is decorative.
  const route = config.routes.scale;
  const skilled = simulate('scale', 'baseline', 'normal');
  const senior = simulate('scale', 'baseline', 'normal', { employee: {
    assemblyHourMultiplier: grades.at(-1).assemblyHourMultiplier,
    failureRateMultiplier: grades.at(-1).failureRateMultiplier,
    monthlySalary: grades.at(-1).monthlySalary,
  } });
  assert.notEqual(skilled.operatingProfit, senior.operatingProfit,
    'changing the grade does not change the result, so the grade multipliers are not wired in');
  const skilledRework = skilled.totalReworkCost;
  const seniorRework = senior.totalReworkCost;
  assert(seniorRework < skilledRework,
    `the better grade did not reduce rework: ${seniorRework} against ${skilledRework}`);

  // Honest record: the grade is defined but has not been shown to pay under a fixed plan.
  const value = [];
  for (const r of Object.keys(config.routes)) {
    const before = simulate(r, 'baseline', 'normal');
    const after = simulate(r, 'baseline', 'normal', { employee: {
      assemblyHourMultiplier: grades.at(-1).assemblyHourMultiplier,
      failureRateMultiplier: grades.at(-1).failureRateMultiplier,
      monthlySalary: grades.at(-1).monthlySalary,
    } });
    const cost = grades.at(-1).trainingCost + (grades.at(-1).monthlySalary - base.monthlySalary) * 6;
    const marginal = after.operatingProfit - before.operatingProfit;
    value.push({ route: r, marginal: Math.round(marginal), cost, payback: Number((marginal / cost).toFixed(2)) });
  }
  const anyPays = value.some(v => v.payback >= 1);

  const output = {
    status: 'passed',
    grades: grades.map(g => ({ order: g.order, zh: g.zh, monthlySalary: g.monthlySalary, assemblyHourMultiplier: g.assemblyHourMultiplier, failureRateMultiplier: g.failureRateMultiplier, trainingCost: g.trainingCost })),
    baseGradeMatchesEconomy: true,
    reworkUnderBestGrade: { skilled: Math.round(skilledRework), senior: Math.round(seniorRework) },
    upgradeValueByRoute: value,
    paysForItself: anyPays,
    openIssue: anyPays ? null : '最高等级在当前固定排产计划下无法回本；与产能类投资同一个根因，需要自适应生产策略或让某条路线真正受产能约束',
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'staff-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run };
