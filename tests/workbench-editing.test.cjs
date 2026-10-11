const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('../.local/tests/game');
const {SaveStore}=require('../.local/tests/save');
const {bill,geometry,evaluate,wiringIssues,requirements,connect}=require('../.local/tests/workbench');
const {DATA}=require('../.local/tests/data');
function prepared(){const g=new Game(),d=g.createDesign('gaming');g.assemble(d.id);g.route(d.id);return {g,d};}

test('moving a fan preserves its orientation, disconnects that fan only, and assistance uses the new endpoint',()=>{
 const {g,d}=prepared(),oldOther=d.cableRoutes.filter(r=>r.to!=='case_fan_0'),revision=d.revision;
 g.setFanPosition(d.id,0,'fan2');assert.equal(d.fanPositions[0],'fan2');assert.equal(d.fanDirections.fan2,'intake');assert(!('fan0' in d.fanDirections));
 assert.deepEqual(d.cableRoutes,oldOther);assert(d.revision>revision);assert.equal(d.test,null);
 assert(wiringIssues(d).some(s=>s.includes('机箱风扇 1')));g.route(d.id);assert.deepEqual(wiringIssues(d),[]);
 const zone=geometry(d).fanZones.find(f=>f.id==='fan2');assert.deepEqual(requirements(d).find(r=>r.id==='case_fan_0').point,[zone.rect[0]+zone.rect[2]/2,zone.rect[1]]);
 const before=JSON.stringify(d);assert.throws(()=>g.setFanPosition(d.id,0,'fan1'));assert.throws(()=>g.setFanPosition(d.id,9,'fan2'));assert.throws(()=>g.setFanPosition(d.id,0,'imaginary'));assert.equal(JSON.stringify(d),before);
});
test('all-intake direction fails with a clear physical explanation and full layout survives reload',()=>{
 const {g,d}=prepared(),routes=JSON.stringify(d.cableRoutes);g.setFanDirection(d.id,1,'intake');
 assert.equal(JSON.stringify(d.cableRoutes),routes);assert(evaluate(d,g.date).blocked.some(s=>s.includes('至少一个进风口和一个出风口')));
 g.setFanDirection(d.id,1,'exhaust');assert.deepEqual(evaluate(d,g.date).blocked,[]);
 const memory=new Map(),store=new SaveStore({getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},{now:()=>1000});store.save(g);const loaded=store.load().game.state.designs[0];
 assert.deepEqual(loaded.fanPositions,d.fanPositions);assert.deepEqual(loaded.fanDirections,d.fanDirections);
 assert.throws(()=>g.setFanDirection(d.id,0,'sideways'));g.state.closed=true;assert.throws(()=>g.setFanPosition(d.id,0,'fan2'));assert.throws(()=>g.setFanDirection(d.id,0,'exhaust'));
});
test('unmounting a motherboard detaches board-mounted parts and wiring without consuming inventory or configuration',()=>{
 const {g,d}=prepared(),config=bill(d),ledger=JSON.stringify({inventory:g.state.inventory,transactions:g.state.transactions,cash:g.state.cash}),revision=d.revision;
 const removed=g.uninstallPart(d.id,'motherboard');assert(removed.includes('motherboard')&&removed.includes('cpu')&&removed.includes('cooler')&&removed.includes('gpu')&&removed.includes('ram0'));
 assert(d.slotAssignments.psu&&d.slotAssignments.disk0);assert.equal(d.cableRoutes.length,0);assert.deepEqual(bill(d),config);assert(d.revision>revision);
 assert.equal(JSON.stringify({inventory:g.state.inventory,transactions:g.state.transactions,cash:g.state.cash}),ledger);
 g.assemble(d.id);g.route(d.id);assert.deepEqual(evaluate(d,g.date).blocked,[]);
 g.uninstallPart(d.id,'cpu');assert(!d.slotAssignments.cpu&&!d.slotAssignments.cooler);assert(d.slotAssignments.motherboard&&d.slotAssignments.gpu);assert(!d.cableRoutes.some(r=>r.to==='cpu_fan'));
});
test('removing a supported hard-drive cage detaches its drives and cables, while unsupported removal is atomic',()=>{
 const {g,d}=prepared();g.changePart(d.id,'case','case_quiet');g.addDrive(d.id,'hdd_1000');g.assemble(d.id);g.route(d.id);
 const config=bill(d),revision=d.revision;assert(d.slotAssignments.disk1);
 g.customize(d.id,{caseModules:{...d.caseModules,removeHddCage:true}});assert.equal(d.revision,revision+1);assert(!d.slotAssignments.disk1);
 assert(!geometry(d).slots.some(s=>s.bay==='3.5-inch'));assert(!d.cableRoutes.some(r=>r.to==='sata_data_1'||r.to==='sata_power_1'));assert.deepEqual(bill(d),config);
 assert(evaluate(d,g.date).blocked.some(s=>s.includes('储存安装位不足')));
 g.customize(d.id,{caseModules:{...d.caseModules,removeHddCage:false}});g.assemble(d.id);g.route(d.id);assert.deepEqual(evaluate(d,g.date).blocked,[]);
 const small=g.createDesign('office'),before=JSON.stringify(small);assert.throws(()=>g.customize(small.id,{caseModules:{...small.caseModules,removeHddCage:true}}));assert.equal(JSON.stringify(small),before);
});
test('adding and removing fans retains chosen positions, directions and unrelated cable connections',()=>{
 const {g,d}=prepared();g.setFanPosition(d.id,0,'fan2');g.setFanDirection(d.id,0,'exhaust');g.route(d.id);
 const before=JSON.stringify(d.cableRoutes);g.customize(d.id,{fanCount:3});assert.deepEqual(d.fanPositions,['fan2','fan1','fan0']);
 assert.equal(d.fanDirections.fan2,'exhaust');assert.equal(JSON.stringify(d.cableRoutes),before);assert(wiringIssues(d).some(s=>s.includes('机箱风扇 3')));
 g.route(d.id);g.customize(d.id,{fanCount:2});assert.deepEqual(d.fanPositions,['fan2','fan1']);assert(!d.cableRoutes.some(r=>r.to==='case_fan_2'));assert(!('fan0' in d.fanDirections));
});
test('front direct wiring cannot pass through a protruding cooler or GPU, while rear assistance remains valid',()=>{
 const {g,d}=prepared(),before=JSON.stringify(d.cableRoutes);
 assert.throws(()=>connect(d,'cpu_power','psu_cpu_0',[]),/散热器/);assert.equal(JSON.stringify(d.cableRoutes),before);
 assert.throws(()=>connect(d,'case_fan_1','hub_fan_1',[]),/散热器|显卡/);assert.equal(JSON.stringify(d.cableRoutes),before);
 d.cableRoutes.find(r=>r.to==='case_fan_1').nodes=[];assert(wiringIssues(d).some(s=>s.includes('直连线穿过显卡')));
 g.route(d.id);assert.deepEqual(wiringIssues(d),[]);
});
test('power-cable bend clearance and real drive envelopes are checked independently of business balance',()=>{
 const {g,d}=prepared(),base=DATA.geometry.find(v=>v.caseId===d.case),previous=base.gpuCableBendMm;
 try {base.gpuCableBendMm=100;assert(evaluate(d,g.date).blocked.some(s=>s.includes('显卡供电线弯折空间不足')));g.changePart(d.id,'gpu','gpu_750ti');g.assemble(d.id);g.route(d.id);assert(!evaluate(d,g.date).blocked.some(s=>s.includes('供电线弯折')));}finally{base.gpuCableBendMm=previous;}
 g.addDrive(d.id,'hdd_1000');g.assemble(d.id);const geo=geometry(d),r=geo.slots.find(s=>s.id===d.slotAssignments.disk1).rect;
 assert.deepEqual(r.slice(2),[147,26.1]);assert(r[0]+r[2]<=geo.width);
 assert.deepEqual(geo.slots.find(s=>s.id==='ssd0').rect.slice(2),[69.85,100]);
});
