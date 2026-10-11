const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Game}=require('../.local/tests/game');
const {DATA}=require('../.local/tests/data');
const {SaveStore}=require('../.local/tests/save');

function ready(custom=false) {
  let roll=.5;
  const random={next:seed=>({seed:seed+1,value:roll})};
  const g=new Game(undefined,'故障账目测试','normal',1000,random);
  const c=custom?g.state.customers.find(c=>c.kind==='quiet_office'):null;
  const d=c?g.acceptCustomer(c.id):g.createDesign('office');
  g.assemble(d.id);g.route(d.id);g.procureMissing(d.id);g.advance(3,false);
  const before=g.state.cash,jobId=g.schedule(d.id),job=g.state.jobs.find(j=>j.id===jobId);
  const development=g.state.transactions.find(t=>t.id===jobId+':development')?.cash||0;
  assert.equal(g.state.cash,before-job.consumables+development,'all scheduled consumables, including rework reserve, are paid');
  g.acknowledgeNews();for(let i=0;i<200&&g.state.jobs.some(j=>j.status!=='complete');i++)g.nextWork();
  assert(d.test);if(!c)g.standardize(d.id);
  return {g,d,c,fault:()=>{roll=0;}};
}

for(const custom of [false,true])test(`${custom?'commission':'standard'} arrival defect receives money before refund, records one review and reconciles profit`,()=>{
  const {g,d,c,fault}=ready(custom),cash=g.state.cash,reviews=g.state.ratingCount,unit=g.state.finished[0];fault();
  const result=c?g.deliver(c.id):g.sellStock(d.id);
  assert.equal(g.state.cash,cash-(c?.deposit||0)-DATA.reliability.arrivalDefect.logisticsCoins);
  assert.equal(g.state.ratingCount,reviews+1);
  assert.equal(unit.deliveryOutcome,'arrival_defect');assert.equal(g.summary.sales,0);
  if(c){assert.equal(result,null);assert.equal(c.deliveryOutcome,'arrival_defect');assert.equal(g.summary.completedCommissions,0);assert.throws(()=>g.deliver(c.id));}
  else {assert.equal(result.sold,0);assert.equal(result.refunded,1);assert.equal(g.sellStock(d.id).sold,0);}
  const report=g.settle();assert.equal(report.revenue,0);assert.equal(report.salesRefunds,d.price);
  assert.equal(report.logisticsCosts,DATA.reliability.arrivalDefect.logisticsCoins);
  assert.equal(report.cogs,unit.cost);assert.equal(report.sold,0);
  assert.equal(report.profit,-unit.cost-report.fixed-report.development-report.logisticsCosts);
  assert.equal(g.state.cash,DATA.economy.opening.normal.cash+g.state.transactions.reduce((n,t)=>n+t.cash,0));
});

test('successful commission recognizes deposit once and produces one review',()=>{
  const {g,d,c}=ready(true),before=g.state.cash,count=g.state.ratingCount;
  assert.equal(typeof g.deliver(c.id),'number');assert(Math.abs(g.state.cash-(before+d.price-c.deposit))<1e-8);
  assert.equal(g.state.ratingCount,count+1);assert.equal(g.settle().revenue,d.price);
});

test('expired unearned deposits affect cash but never sales revenue or profit',()=>{
  const g=new Game(undefined,'逾期','normal',1000),c=g.state.customers.find(c=>c.kind==='quiet_office');g.acceptCustomer(c.id);
  const before=g.state.cash,report=g.settle();
  assert.equal(report.depositRefunds,c.deposit);assert.equal(report.salesRefunds,0);
  assert.equal(report.revenue,0);assert.equal(report.profit,-report.fixed);
  assert.equal(g.state.cash,before-c.deposit-report.fixed);assert.equal(c.status,'expired');
});

test('v2 legacy defect outcomes are inferred without rewriting historical cash, designs or profit',()=>{
  const {g,d,fault}=ready();fault();g.sellStock(d.id);g.settle();
  const old=JSON.parse(JSON.stringify(g.state)),unit=old.finished[0],sale=old.transactions.find(t=>t.id===unit.id+':sale');
  old.transactions=old.transactions.filter(t=>t!==sale);old.cash-=sale.cash;
  for(const t of old.transactions)if(['salesRefund','logistics'].includes(t.kind))t.kind='refund';
  delete unit.deliveryOutcome;
  for(const r of old.reports){delete r.salesRefunds;delete r.logisticsCosts;delete r.depositRefunds;delete r.legacyAccounting;}
  const cash=old.cash,designs=JSON.stringify(old.designs),profit=old.reports[0].profit;
  const restored=new Game(old);
  assert.equal(restored.state.cash,cash);assert.equal(JSON.stringify(restored.state.designs),designs);
  assert.equal(restored.state.reports[0].profit,profit);assert(restored.state.reports[0].legacyAccounting);
  assert.equal(restored.state.finished[0].deliveryOutcome,'arrival_defect');assert.equal(restored.summary.sales,0);
  const memory=new Map(),store=new SaveStore({getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},{now:()=>1000});
  store.save(restored);assert.equal(store.load().game.state.cash,cash);assert.equal(JSON.parse(memory.get('orangegame.save.v1')).version,2);
});
