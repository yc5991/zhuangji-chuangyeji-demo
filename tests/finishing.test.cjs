const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('../.local/tests/game'),{evaluate}=require('../.local/tests/workbench'),{finishing}=require('../.local/tests/finishing'),{SaveStore}=require('../.local/tests/save');
function finish(g){g.acknowledgeNews();for(let i=0;i<200&&g.state.jobs.some(j=>j.status!=='complete');i++)g.nextWork();assert(g.state.jobs.every(j=>j.status==='complete'));}
test('finish and panel choices affect the shared design, invalidate tests and survive reload',()=>{
 const g=new Game(undefined,'工艺记录','easy',1000),d=g.createDesign('office');g.assemble(d.id);g.route(d.id);
 const baseline=evaluate(d,g.date);g.customize(d.id,{finishLevelId:'brushed',caseModules:{...d.caseModules,panel:'mesh'}});
 const changed=evaluate(d,g.date);assert(changed.appearance>baseline.appearance);assert(changed.noise>baseline.noise);assert.equal(d.test,null);assert(!d.prototypeMade);assert(finishing(d).cost>0);
 const unchanged=JSON.stringify(d);assert.throws(()=>g.customize(d.id,{finishLevelId:'missing'}));assert.equal(JSON.stringify(d),unchanged);
 const memory=new Map(),store=new SaveStore({getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},{now:()=>1000});store.save(g);
 assert.deepEqual(store.load().game.design(d.id),d);
});
test('paid finish work is scheduled once and part-only rework retains it without repeating the finish stage',()=>{
 const g=new Game(undefined,'工艺排产','easy',1000),d=g.createDesign('office');g.customize(d.id,{finishLevelId:'brushed'});g.assemble(d.id);g.route(d.id);g.procureMissing(d.id);g.advance(3,false);
 const jobId=g.schedule(d.id),job=g.state.jobs.find(j=>j.id===jobId);assert.equal(job.stages.filter(s=>s.name==='外观工艺').length,1);finish(g);
 assert.equal(g.state.finished[0].design.finishLevelId,'brushed');const count=g.state.transactions.length;g.advance(8,false);assert.equal(g.state.transactions.length,count);
 g.changePart(d.id,'storage','ssd_250');g.assemble(d.id);g.route(d.id);g.procureMissing(d.id);g.advance(3,false);
 const reworkId=g.schedule(d.id),rework=g.state.jobs.find(j=>j.id===reworkId);assert(!rework.stages.some(s=>s.name==='外观工艺'));finish(g);
 assert.equal(g.state.finished.length,1);assert.equal(g.state.finished[0].design.finishLevelId,'brushed');assert.equal(g.state.finished[0].design.storage[0].id,'ssd_250');
});
