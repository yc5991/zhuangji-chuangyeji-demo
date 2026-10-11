const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runRoute}=require('./helpers/six-month.cjs');
for(const route of ['boutique','scale','mixed'])test(`normal ${route}: six active months of procurement, production, sales and save recovery`,()=>{
  const run=runRoute(route);assert.equal(run.summary.months,6);
  for(const report of run.evidence)assert(report.sold>0);
  assert(run.actions.some(a=>a.action.includes('revision')||a.action.includes('rework')));
  assert.equal(run.summary.direction,route);
});
