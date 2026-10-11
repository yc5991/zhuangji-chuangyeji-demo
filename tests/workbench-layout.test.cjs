const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('../.local/tests/game');
const {DATA}=require('../.local/tests/data');
const {geometry,boardPoint,part,requirements,connectors,evaluate,nearestSlot,install}=require('../.local/tests/workbench');
const {viewPoint,viewRect}=require('../.local/tests/workbench-view');
const near=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('B150 CPU, DIMM and power endpoints align to the measured untrimmed board body',()=>{
 const g=new Game(),d=g.createDesign('gaming'),layout=DATA.boardLayouts.find(b=>b.partId===d.motherboard);
 assert.equal(d.motherboard,'mb_b150');const slots=geometry(d).slots;
 const cpu=slots.find(s=>s.id==='cpu').rect,center=boardPoint(d,layout.cpuCenterPx);
 assert(Math.abs(center[0]-129.739)<.01); // Independent measured-board reference, rounded to a hundredth of a millimetre.
 assert(Math.abs(center[1]-324.604)<.01);near(cpu[0]+cpu[2]/2,center[0]);near(cpu[1]+cpu[3]/2,center[1]);
 layout.dimmCentersPx.forEach((p,i)=>{const r=slots.find(s=>s.id===`ram${i}`).rect,q=boardPoint(d,p);near(r[0]+r[2]/2,q[0]);near(r[1]+r[3]/2,q[1]);});
 assert.deepEqual(requirements(d).find(r=>r.id==='main_power').point,boardPoint(d,layout.connectorsPx.mainPower));
 assert.deepEqual(connectors(d).find(s=>s.id==='board_cpu_fan').point,boardPoint(d,layout.connectorsPx.cpuFan));
});
test('changing boards changes physical footprints and slot locations without mutating shared case geometry',()=>{
 const g=new Game(),d=g.createDesign('office'),base=JSON.stringify(DATA.geometry),small=geometry(d);
 assert.equal(small.slots.filter(s=>s.kind==='ram').length,2);assert.deepEqual(small.slots.find(s=>s.id==='motherboard').rect.slice(2),[183,226]);
 g.changePart(d.id,'motherboard','mb_b150');const large=geometry(d);
 assert.equal(large.slots.filter(s=>s.kind==='ram').length,4);assert.deepEqual(large.slots.find(s=>s.id==='motherboard').rect.slice(2),[218,305]);
 assert(evaluate(d,g.date,false).blocked.some(s=>s.includes('主板尺寸')));assert.equal(JSON.stringify(DATA.geometry),base);
});
test('GPU, PSU and cooler bodies use the selected component size rather than the case maximum',()=>{
 const g=new Game(),d=g.createDesign('gaming'),before=geometry(d).slots.find(s=>s.id==='gpu').rect;
 assert.deepEqual(before.slice(2),[part(d.gpu).game.dimensionsMm.length,part(d.gpu).game.dimensionsMm.thickness]);
 g.changePart(d.id,'gpu','gpu_750ti');g.changePart(d.id,'psu','psu_650m');g.changePart(d.id,'cooler','cooler_low');const geo=geometry(d);
 assert.deepEqual(geo.slots.find(s=>s.id==='gpu').rect.slice(2),[165,33]);
 assert.deepEqual(geo.slots.find(s=>s.id==='psu').rect.slice(2),[160,86]);assert.deepEqual(geo.slots.find(s=>s.id==='cooler').rect.slice(2),[100,100]);
 const gpu=geo.slots.find(s=>s.id==='gpu').rect,layout=DATA.boardLayouts.find(b=>b.partId===d.motherboard);
 near(gpu[1]+gpu[3],boardPoint(d,layout.pcieLinePx)[1]);
});
test('rear projection mirrors complete rectangles and is its own inverse for drag and cable points',()=>{
 const width=430,rect=[350,101,70,100],point=[367,135];
 assert.deepEqual(viewRect(rect,width,'rear'),[10,101,70,100]);assert.deepEqual(viewPoint(point,width,'rear'),[63,135]);
 assert.deepEqual(viewRect(viewRect(rect,width,'rear'),width,'rear'),rect);assert.deepEqual(viewPoint(viewPoint(point,width,'rear'),width,'rear'),point);
 assert.deepEqual(viewRect(rect,width,'side'),rect);assert.deepEqual(viewPoint(point,width,'exterior'),point);
});
test('overlapping DIMM touch targets choose the nearest free slot and never change physical geometry',()=>{
 const g=new Game(),d=g.createDesign('gaming'),geo=geometry(d),before=JSON.stringify(geo);
 for(let i=0;i<4;i++) {const r=geo.slots.find(s=>s.id===`ram${i}`).rect;assert.equal(nearestSlot(d,'ram0','side',[r[0]+r[2]/2,r[1]+r[3]/2],60),`ram${i}`);}
 install(d,'ram0','ram0');d.ram[0].quantity=2;const r=geo.slots.find(s=>s.id==='ram0').rect;
 assert.notEqual(nearestSlot(d,'ram1','side',[r[0]+r[2]/2,r[1]+r[3]/2],60),'ram0');
 assert.equal(nearestSlot(d,'cpu','rear',[0,0],60),null);assert.equal(nearestSlot(d,'cpu','side',[1000,1000],60),null);
 assert.equal(JSON.stringify(geometry(d)),before);
});
