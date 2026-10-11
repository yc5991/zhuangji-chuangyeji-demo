const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Game}=require('../.local/tests/game');
const {SaveStore,FutureSaveError}=require('../.local/tests/save');
const {DATA}=require('../.local/tests/data');
const {evaluate,connect,requirements,geometry,install}=require('../.local/tests/workbench');
function prepared(g,kind='office') {const d=g.createDesign(kind);g.assemble(d.id);g.route(d.id);assert.deepEqual(evaluate(d,g.date).blocked,[]);return d;}
function finish(g) {g.acknowledgeNews();for(let i=0;i<200&&g.state.jobs.some(j=>j.status!=='complete');i++) g.nextWork();assert(g.state.jobs.every(j=>j.status==='complete'));}
function build(g,d) {g.procureMissing(d.id);g.advance(3,false);g.schedule(d.id);finish(g);assert(d.prototypeMade&&d.test);}
test('January independent product completes design, procurement, prototype, test, price, standardization and sale',()=>{
 const g=new Game(),d=prepared(g);build(g,d);g.setIdentity(d.id,'橙序 入门一号',d.price);g.standardize(d.id);
 assert.equal(g.sellStock(d.id).sold,1);assert.equal(g.sellStock(d.id).sold,0);assert.equal(g.state.month,1);
 const sales=g.state.transactions.filter(t=>t.kind==='sale');assert.equal(sales.length,1);
});
test('January custom commission pays deposit once and delivers the current complete design',()=>{
 const g=new Game(),c=g.state.customers.find(c=>c.kind==='quiet_office'),cash=g.state.cash;
 const d=g.acceptCustomer(c.id);assert.equal(g.state.cash,cash+c.deposit);assert.throws(()=>g.acceptCustomer(c.id));
 g.assemble(d.id);g.route(d.id);assert.deepEqual(g.customerIssues(d,c),[]);build(g,d);
 g.deliver(c.id);assert.equal(c.status,'completed');assert.throws(()=>g.deliver(c.id));
 const actual=g.state.transactions.filter(t=>t.id===`${c.id}:deposit`||t.kind==='sale').reduce((n,t)=>n+t.cash,0);assert.equal(actual,d.price);
});
test('credit and discounts apply to the confirmed same-SKU order, without retroactive grouping',()=>{
 const g=new Game(),p=DATA.parts.find(p=>p.category==='ram'),cash=g.state.cash;
 assert.throws(()=>g.purchase(p.id,4,'distributor'));
 g.purchase(p.id,1);g.purchase(p.id,1);assert.equal(g.state.purchases[0].unitCost,g.quote(p.id,1,'retail').unitCost);
 const before=g.state.cash;g.purchase(p.id,5,'distributor');assert.equal(g.state.cash,before);assert(g.outstandingCredit>0);
 g.settle();assert.equal(g.state.purchases[2].paid,false);g.settle();assert.equal(g.state.purchases[2].paid,true);
 assert(g.state.cash<cash);
});
test('batch jobs consume integer physical parts from different cost lots and do not double reserve',()=>{
 const g=new Game(),d=prepared(g);build(g,d);g.standardize(d.id);
 g.procureMissing(d.id,3,'retail',false);g.advance(3,false);g.schedule(d.id,3,'production');finish(g);
 assert.equal(g.state.finished.length,4);
 for(const lot of g.state.inventory) {assert(Number.isInteger(lot.quantity));assert.equal(lot.reserved,0);}
 for(const unit of g.state.finished) for(const c of unit.components) assert(Number.isInteger(c.quantity));
});
test('rework recovers changed parts and retains unchanged components without purchasing a second computer',()=>{
 const g=new Game(),d=prepared(g);build(g,d);const before=g.state.finished[0];const replacement=DATA.parts.find(p=>p.id==='ssd_250');
 g.changePart(d.id,'storage',replacement.id);g.assemble(d.id);g.route(d.id);
 const missing=g.missing(d.id);assert.deepEqual(missing,[{id:replacement.id,quantity:1}]);
 build(g,d);assert.equal(g.state.finished.length,1);assert.equal(g.available(before.design.systemDrive),1);
 assert(g.state.finished[0].components.some(c=>c.partId===replacement.id));
});
test('manual wiring uses typed connectors and adjacent channels; assistance follows the same validation',()=>{
 const g=new Game(),d=prepared(g,'gaming');assert.throws(()=>connect(d,'cpu_power','psu_gpu_0',['A01']));
 assert.throws(()=>connect(d,'cpu_power','psu_cpu_0',['A01','A06']));
 const ram=DATA.parts.find(p=>p.category==='ram'&&p.game.ramType==='DDR3');g.changePart(d.id,'ram',ram.id);g.assemble(d.id);g.route(d.id);
 assert(evaluate(d,g.date).blocked.some(x=>x.includes('内存代际')));
 assert.throws(()=>install(d,'cpu','psu'));assert.equal(geometry(d).units,'mm');
});
test('online, acceleration, offline reload and repeated login share a ledger and never advance the month',()=>{
 const g=new Game(undefined,'测试','normal',1000),d=prepared(g);g.procureMissing(d.id);g.advance(3,false);g.schedule(d.id);g.acknowledgeNews();
 const memory=new Map(),adapter={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};let now=1000;
 const store=new SaveStore(adapter,{now:()=>now});store.save(g);now+=3600000;const loaded=store.load().game;assert(loaded);assert.equal(loaded.state.month,1);
 const transactionCount=loaded.state.transactions.length;loaded.resume(now);assert.equal(loaded.state.transactions.length,transactionCount);
 store.save(loaded);const again=store.load().game;assert.equal(again.state.finished.length,1);assert.equal(again.state.month,1);
 assert.deepEqual(again.state.designs[0].slotAssignments,d.slotAssignments);assert.deepEqual(again.state.designs[0].cableRoutes,d.cableRoutes);
});
test('backup recovery and future version preserve saved records',()=>{
 const memory=new Map(),adapter={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};const store=new SaveStore(adapter,{now:()=>1000}),g=new Game();
 store.save(g);store.save(g);memory.set('orangegame.save.v1','corrupt');assert(store.load().recovered);
 const future=JSON.stringify({version:100});memory.set('orangegame.save.v1',future);
 assert.throws(()=>store.load(),FutureSaveError);assert.throws(()=>store.save(g),FutureSaveError);assert.equal(memory.get('orangegame.save.v1'),future);
});
test('offline work finishes schedules despite unread announcements, and stops at the current month',()=>{
 const g=new Game(undefined,'测试','normal',1000),d=prepared(g);g.procureMissing(d.id);g.advance(3,false);g.schedule(d.id);
 g.state.pendingNews=['尚未阅读的采购提醒'];g.resume(1000+10000000);assert.equal(g.state.month,1);assert(g.state.finished.length===1);assert.equal(g.state.elapsed,g.monthHours);
});
test('six settlements close the Demo and cannot repeat June accounting',()=>{
 const g=new Game(undefined,'测试','easy');for(let i=0;i<6;i++) g.settle();assert(g.state.closed);assert.equal(g.state.reports.length,6);assert.throws(()=>g.settle());
});

