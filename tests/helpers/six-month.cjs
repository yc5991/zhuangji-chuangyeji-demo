const assert=require('node:assert/strict');
const {Game}=require('../../.local/tests/game');
const {DATA}=require('../../.local/tests/data');
const {SaveStore}=require('../../.local/tests/save');

function finish(g) {
  g.acknowledgeNews();
  for(let i=0;i<1000&&g.state.jobs.some(j=>j.status!=='complete');i++){
    const before=g.state.elapsed;g.nextWork();
    if(before===g.state.elapsed&&g.state.elapsed===g.monthHours)throw new Error('month exhausted with unfinished jobs');
  }
  assert(g.state.jobs.every(j=>j.status==='complete'));
}
function build(g,d,quantity=1,kind='prototype') {
  if(kind==='prototype'){g.assemble(d.id);g.route(d.id);}
  g.procureMissing(d.id,quantity,'retail',kind==='prototype');
  g.advance(3,false);g.schedule(d.id,quantity,kind);finish(g);assert(d.test?.revision===d.revision);
}
function runRoute(route) {
  let g=new Game(undefined,'六个月 '+route,'normal',20261011);
  const evidence=[],snapshots=[],actions=[];
  const memory=new Map();let now=20261011;
  const store=new SaveStore({getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},{now:()=>now});
  let standardId=null;
  for(let month=1;month<=6;month++){
    const txStart=g.state.transactions.length;
    if(month===3&&route!=='scale'){g.invest('craft_tools');actions.push({month,action:'craft_tools'});}
    if(month===5&&route!=='boutique'){g.invest('bench');if(route==='scale')g.invest('semi_auto');actions.push({month,action:route==='scale'?'bench+semi_auto':'bench'});}
    if(route!=='scale'){
      const customer=g.state.customers.find(c=>c.dueMonth===month&&c.kind==='quiet_office'&&c.status==='open');
      const d=g.acceptCustomer(customer.id);build(g,d);
      if(month===2){g.changePart(d.id,'storage','ssd_250');build(g,d);actions.push({month,action:'commission_rework'});}
      g.deliver(customer.id);
    }
    if(route!=='boutique'){
      let d=standardId?g.design(standardId):g.createDesign('office');
      if(!standardId){standardId=d.id;build(g,d);g.standardize(d.id);g.sellStock(d.id);}
      if(month===2){g.customize(d.id,{colors:{...d.colors,body:'silver'}});build(g,d);g.standardize(d.id);actions.push({month,action:'standard_revision'});}
      const quantity=Math.min(route==='scale'?6:2,Math.max(1,g.demandAssessment(d.id).available));
      build(g,d,quantity,'production');g.sellStock(d.id);
    }
    if(month===3){const id=g.purchase('ram_ddr4_4',1);actions.push({month,action:'prebuy_ram',purchaseId:id});g.advance(3,false);}
    if(month===4){const locked=g.state.purchases.find(p=>p.id===actions.find(a=>a.action==='prebuy_ram').purchaseId);assert(locked.unitCost>0);actions.push({month,action:'market_outcome',outcome:g.state.marketRecords[0].outcomeId,quote:g.unitPrice('ram_ddr4_4'),lockedCost:locked.unitCost});}
    const entries=g.state.transactions.slice(txStart);assert(entries.some(t=>t.kind==='procurement'));assert(entries.some(t=>t.kind==='production'));assert(entries.some(t=>t.kind==='sale'));
    const report=g.settle();assert.equal(report.month,month);assert.equal(report.sold,report.standardSold+report.commissionSold);
    assert.equal(report.profit,report.revenue-report.cogs-report.fixed-report.development-report.logisticsCosts);
    assert(Math.abs(report.cash-(DATA.economy.opening.normal.cash+g.state.transactions.reduce((n,t)=>n+t.cash,0)))<1e-7);
    assert(!g.state.bankrupt,'functional route must reach June; balance failures are reported without changing parameters');
    store.save(g);const before=JSON.stringify(g.state.designs),ledger=g.state.transactions.length;
    g=store.load().game;assert.equal(JSON.stringify(g.state.designs),before);assert.equal(g.state.transactions.length,ledger);
    assert.equal(g.state.month,Math.min(month+1,6));
    evidence.push(report);snapshots.push(JSON.parse(JSON.stringify(g.state)));
  }
  assert(g.state.closed);assert.equal(g.state.reports.length,6);assert.throws(()=>g.settle());
  assert.equal(g.summary.sales,evidence.reduce((n,r)=>n+r.sold,0));
  return {route,evidence,snapshots,actions,summary:g.summary,state:g.state,save:JSON.parse(memory.get('orangegame.save.v1'))};
}
module.exports={runRoute,build,finish};
