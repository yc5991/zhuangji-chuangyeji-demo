const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Game}=require('../.local/tests/game');
const {SaveStore}=require('../.local/tests/save');
const {DATA}=require('../.local/tests/data');
const {build}=require('./helpers/six-month.cjs');
const random={next:seed=>({seed:seed+1,value:.5})};
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function earnHardWorkingCapital(g,count=3) {
  if(g.state.difficulty!=='hard')return;
  for(let i=0;i<count;i++) {
    const c=g.state.customers.find(c=>c.kind==='quiet_office'&&c.status==='open');
    assert(c,'hard route uses real available commissions');const d=g.acceptCustomer(c.id);build(g,d);g.deliver(c.id);
  }
}

for(const difficulty of ['easy','hard']) {
  test(`${difficulty}: unaffordable procurement leaves cash, stock and ledger unchanged`,()=>{
    const g=new Game(undefined,'资金风险',difficulty,20261011,random);
    while(g.state.cash>=DATA.economy.investments.bench.cost)g.invest('bench');
    const candidate=DATA.parts.find(p=>p.release<=g.date&&g.unitPrice(p.id)>g.state.cash);
    assert(candidate,'normal purchases and investments reach a real insufficient-cash boundary');
    const before=JSON.stringify({cash:g.state.cash,purchases:g.state.purchases,inventory:g.state.inventory,transactions:g.state.transactions,supplierStock:g.state.supplierStock});
    assert.throws(()=>g.purchase(candidate.id,1),/资金不足/);
    assert.equal(JSON.stringify({cash:g.state.cash,purchases:g.state.purchases,inventory:g.state.inventory,transactions:g.state.transactions,supplierStock:g.state.supplierStock}),before);
  });
  test(`${difficulty}: unsold computers carry cost without recognizing sales income`,()=>{
    const g=new Game(undefined,'库存风险',difficulty,20261011,random);earnHardWorkingCapital(g);if(difficulty==='hard')g.settle();
    const d=g.createDesign('office');build(g,d);g.standardize(d.id);
    const unit=g.state.finished.find(u=>u.designId===d.id),stockCost=unit.cost,report=g.settle();
    assert.equal(report.sold,0);assert.equal(report.revenue,0);assert.equal(report.cogs,0);
    assert.equal(report.stockCost,stockCost);assert.equal(report.unsold,1);assert.equal(unit.status,'stock');
    near(report.profit,-report.fixed-report.development);
  });
  test(`${difficulty}: expired deposits affect cash, supplier bills are paid only once at maturity`,()=>{
    const g=new Game(undefined,'到期账目',difficulty,20261011,random);earnHardWorkingCapital(g,2);const c=g.state.customers.find(c=>c.kind==='quiet_office'&&c.status==='open');
    g.acceptCustomer(c.id);const purchaseId=g.purchase('ram_ddr4_4',5,'distributor'),p=g.state.purchases.find(p=>p.id===purchaseId),due=p.dueMonth;
    const earned=g.state.transactions.filter(t=>t.kind==='sale').reduce((n,t)=>n+t.cash,0)+g.state.transactions.filter(t=>t.kind==='earnedDeposit').reduce((n,t)=>n+Number(t.note),0);
    const cogs=g.state.transactions.filter(t=>t.kind==='sale').reduce((n,t)=>n+t.cost,0);
    const cash=g.state.cash,first=g.settle();
    near(first.cash,cash-c.deposit-first.fixed);assert.equal(first.depositRefunds,c.deposit);assert.equal(first.revenue,earned);near(first.profit,earned-cogs-first.fixed);
    assert.equal(c.status,'expired');assert.equal(g.state.transactions.filter(t=>t.id===c.id+':refund').length,1);
    while(g.state.month<due)g.settle();const before=g.state.cash,report=g.settle();
    assert(p.paid);near(report.cash,before-report.fixed-p.quantity*p.unitCost);
    if(g.state.closed)assert.throws(()=>g.settle());else g.settle();assert.equal(g.state.transactions.filter(t=>t.id===p.id+':payment').length,1);
  });
  test(`${difficulty}: offline recovery preserves cross-month jobs, designs and single accounting`,()=>{
    let g=new Game(undefined,'跨月离线',difficulty,1000,random);earnHardWorkingCapital(g);const d=g.createDesign('office');g.assemble(d.id);g.route(d.id);g.procureMissing(d.id);g.advance(3,false);
    g.advance(g.monthHours-g.state.elapsed-1,false);const jobId=g.schedule(d.id),initialUnits=g.state.finished.length;
    const memory=new Map();let now=1000;const store=new SaveStore({getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},{now:()=>now});
    store.save(g);const design=JSON.stringify(d),reservations=JSON.stringify(g.state.jobs.find(j=>j.id===jobId).materialReservations);now+=24*3600000;g=store.load().game;
    assert.equal(g.state.month,1);assert.equal(g.state.elapsed,g.monthHours);assert.equal(g.state.finished.length,initialUnits);
    assert.equal(JSON.stringify(g.state.designs.find(item=>item.id===d.id)),design);assert.equal(JSON.stringify(g.state.jobs.find(j=>j.id===jobId).materialReservations),reservations);
    g.settle();assert.equal(g.state.month,2);store.save(g);now+=24*3600000;g=store.load().game;
    assert.equal(g.state.month,2);assert.equal(g.state.finished.length,initialUnits+1);assert.equal(g.state.jobs.find(j=>j.id===jobId).status,'complete');
    const count=g.state.transactions.length,cost=g.state.finished.at(-1).cost;g.resume(now);store.save(g);g=store.load().game;
    assert.equal(g.state.transactions.length,count);assert.equal(g.state.finished.length,initialUnits+1);assert.equal(g.state.finished.at(-1).cost,cost);
    near(g.state.cash,DATA.economy.opening[difficulty].cash+g.state.transactions.reduce((n,t)=>n+t.cash,0));
  });
}
