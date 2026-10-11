const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Game}=require('../.local/tests/game');
const {SaveStore}=require('../.local/tests/save');
const {DATA}=require('../.local/tests/data');
const clone=value=>JSON.parse(JSON.stringify(value));
function build(g,d) {
  g.assemble(d.id);g.route(d.id);g.procureMissing(d.id);g.advance(3,false);g.schedule(d.id);g.acknowledgeNews();
  for(let i=0;i<200&&g.state.jobs.some(j=>j.status!=='complete');i++)g.nextWork();
  assert(d.prototypeMade&&d.test);
}
function memoryStore() {const memory=new Map();return {memory,adapter:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)}};}
function checksum(text) {let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);return (hash>>>0).toString(16);}

test('market omen, saved outcome and expiry change only new purchases',()=>{
  let draws=0;const random={next:seed=>{draws++;return {seed:seed+1,value:.9}}};
  const g=new Game(undefined,'市场记录','easy',1000,random),ram=DATA.parts.find(p=>p.category==='ram');
  const base=g.unitPrice(ram.id),cpu=DATA.parts.find(p=>p.category==='cpu'),cpuBase=g.unitPrice(cpu.id);
  g.settle();g.settle();assert.equal(g.state.month,3);
  const event=g.state.marketRecords[0];assert.equal(event.outcomeId,null);assert(g.state.pendingNews.some(n=>n.includes('预兆')));
  const first=g.purchase(ram.id,1,'retail');g.advance(3,false);
  const oldLot=clone(g.state.inventory.find(l=>l.orderId===first));
  g.advance(155,false);const incomingId=g.purchase(ram.id,1,'retail'),incoming=g.state.purchases.find(p=>p.id===incomingId);assert(!incoming.received);
  g.settle();assert.equal(g.state.month,4);assert(event.outcomeId);assert.equal(event.roll,.9);
  assert(g.unitPrice(ram.id)>base);assert.equal(g.unitPrice(cpu.id),cpuBase);
  assert.equal(incoming.unitCost,base);assert.deepEqual(g.state.inventory.find(l=>l.id===oldLot.id),oldLot);
  const before=draws,copy=new Game(clone(g.state),undefined,undefined,undefined,random);
  assert.equal(draws,before);assert.equal(copy.state.seed,g.state.seed);assert.deepEqual(copy.state.marketRecords,g.state.marketRecords);
  g.advance(3,false);assert.equal(g.state.inventory.find(l=>l.orderId===incoming.id).unitCost,base);
  const newId=g.purchase(ram.id,1,'retail');assert.equal(g.state.purchases.find(p=>p.id===newId).unitCost,g.unitPrice(ram.id));
  g.settle();assert.equal(g.priceFactor(ram.id),event.multiplier);g.settle();assert.equal(g.state.month,6);
  assert.equal(g.priceFactor(ram.id),1);assert(event.expired);assert.equal(g.unitPrice(ram.id),base);
});

test('version 1 saves migrate complete designs and preserve unavailable historical costs as unknown',()=>{
  const g=new Game(undefined,'旧记录','easy',1000),d=g.createDesign('office');build(g,d);g.setIdentity(d.id,'保留作品',d.price);g.standardize(d.id);g.sellStock(d.id);g.settle();
  const legacy=clone(g.state);legacy.schemaVersion=1;delete legacy.marketRecords;delete legacy.tutorial;
  for(const report of legacy.reports)for(const key of ['feedback','stockCost','payables','standardSold','commissionSold'])delete report[key];
  const {memory,adapter}=memoryStore(),payload=JSON.stringify(legacy);
  memory.set('orangegame.save.v1',JSON.stringify({version:1,payload,checksum:checksum(payload),savedAt:1000}));
  const store=new SaveStore(adapter,{now:()=>1000}),loaded=store.load().game;
  assert.equal(loaded.state.schemaVersion,2);assert.deepEqual(loaded.state.designs,g.state.designs);assert.deepEqual(loaded.state.transactions,g.state.transactions);
  assert.equal(loaded.state.reports[0].stockCost,null);assert.equal(loaded.state.reports[0].standardSold,1);
  store.save(loaded);assert.equal(JSON.parse(memory.get('orangegame.save.v1')).version,2);
  assert.deepEqual(store.load().game.state.designs,g.state.designs);
});

test('template commission copies the complete design but requires a separate physical unit and current test',()=>{
  const g=new Game(undefined,'机型复用','easy',1000),first=g.state.customers.find(c=>c.kind==='quiet_office'),original=g.acceptCustomer(first.id);
  build(g,original);g.setIdentity(original.id,'安静一号',original.price);g.deliver(first.id);
  const frozen=clone(original),soldId=g.state.finished[0].id;g.settle();
  const c=g.state.customers.find(c=>c.dueMonth===2&&c.kind==='quiet_office'),d=g.acceptUsingTemplate(c.id,original.id);
  assert.notEqual(d.id,original.id);assert.deepEqual(original,frozen);assert.deepEqual(d.slotAssignments,original.slotAssignments);assert.deepEqual(d.cableRoutes,original.cableRoutes);
  assert.equal(d.colors.body,c.color);assert.equal(d.test,null);assert(!d.prototypeMade);assert.throws(()=>g.deliver(c.id));
  build(g,d);g.deliver(c.id);assert.equal(g.state.finished.length,2);assert.equal(g.state.finished.find(u=>u.id===soldId).customerId,first.id);
  assert.equal(g.state.customers.find(order=>order.id===c.id).deposit,c.deposit);assert.throws(()=>g.acceptUsingTemplate(c.id,original.id));
});

test('six-month report summarizes actual products, customers, capacity and chosen route without profit ranking',()=>{
  const g=new Game(undefined,'六个月记录','easy',1000);assert.equal(g.summary.direction,'workshop');
  const d=g.createDesign('office');build(g,d);g.setIdentity(d.id,'产品一号',d.price);g.standardize(d.id);g.sellStock(d.id);
  const c=g.state.customers.find(c=>c.kind==='quiet_office'),custom=g.acceptCustomer(c.id);build(g,custom);g.deliver(c.id);
  g.invest('craft_tools');g.invest('semi_auto');for(let i=0;i<6;i++)g.settle();
  const a=g.summary;assert.equal(a.months,6);assert.equal(a.sales,2);assert.equal(a.standardSales,1);assert.equal(a.commissionSales,1);
  assert.equal(a.completedCommissions,1);assert.equal(a.direction,'mixed');assert.equal(a.capacity.bench,g.capacity.bench);
  assert(a.works.some(w=>w.name==='产品一号'&&w.sold===1));assert.equal(a.revenue,g.state.reports.reduce((n,r)=>n+r.revenue,0));
  assert.equal(g.state.reports[0].standardSold,1);assert.equal(g.state.reports[0].commissionSold,1);
  const before=clone(g.state);assert.throws(()=>g.settle());assert.throws(()=>g.installPart(d.id,'cpu','cpu'));assert.throws(()=>g.connectWire(d.id,'main_power','psu_main',[]));assert.throws(()=>g.standardize(d.id));
  assert.deepEqual(clone(g.state),before);
});

test('customer feedback reports unmet requirements and monthly demand after sales',()=>{
  const g=new Game(undefined,'客群反馈','easy',1000),d=g.createDesign('gaming');build(g,d);g.standardize(d.id);
  g.setIdentity(d.id,d.name,1000000);let a=g.demandAssessment(d.id);assert.equal(a.available,0);assert(a.rows.every(r=>r.issues.some(i=>i.includes('售价'))));assert.equal(g.sellStock(d.id).sold,0);
  g.setIdentity(d.id,d.name,DATA.economy.products.gaming.salePrice);a=g.demandAssessment(d.id);assert(a.available>0);const before=a.available;
  assert.equal(g.sellStock(d.id).sold,1);assert.equal(g.demandAssessment(d.id).available,before-1);
});

test('a newer state format inside a valid envelope is preserved and cannot be replaced by an older game',()=>{
  const {memory,adapter}=memoryStore(),store=new SaveStore(adapter,{now:()=>1000}),g=new Game();store.save(g);store.save(g);
  const future=clone(g.state);future.schemaVersion=3;const payload=JSON.stringify(future),record=JSON.stringify({version:2,payload,checksum:checksum(payload),savedAt:1000});
  memory.set('orangegame.save.v1',record);assert.throws(()=>store.load(),/更新/);assert.throws(()=>store.save(g),/更新/);assert.equal(memory.get('orangegame.save.v1'),record);
});
