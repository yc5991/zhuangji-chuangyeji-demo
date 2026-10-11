const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('every reviewed procurement illustration has a stable sprite importer and matches the fixed catalog',()=>{
 const entries=JSON.parse(fs.readFileSync('design/art-runtime.json')).entries.filter(e=>e.view==='product');
 const parts=JSON.parse(fs.readFileSync('design/components.json')).parts;
 assert.deepEqual(entries.map(e=>e.partId).sort(),parts.map(p=>p.id).sort());
 const uuidPaths=new Map();
 for(const e of entries){
  const file=path.join('assets/art',e.bundle,e.path+'.png'),meta=JSON.parse(fs.readFileSync(file+'.meta')),png=fs.readFileSync(file);
  assert.equal(meta.importer,'image');assert.equal(meta.userData.type,'sprite-frame',file);
  assert.match(meta.uuid,/^[a-f0-9-]{36}$/);assert.deepEqual(e.exportPx,[png.readUInt32BE(16),png.readUInt32BE(20)]);
  if(uuidPaths.has(meta.uuid))assert.equal(uuidPaths.get(meta.uuid),file);else uuidPaths.set(meta.uuid,file);
  assert.equal(e.reviewScope,'procurement-silhouette-materials-alpha-and-catalog-mapping-only');
 }
});

test('every catalog part has a fixed installation view, exact Figma pixels and stable UUIDs',()=>{
 const entries=JSON.parse(fs.readFileSync('design/art-runtime.json')).entries.filter(e=>['side','rear'].includes(e.view));
 const records=JSON.parse(fs.readFileSync('art/figma/workbench-runtime-review.json')).entries;
 const parts=JSON.parse(fs.readFileSync('design/components.json')).parts;
 const crypto=require('node:crypto');
 assert.equal(entries.length,39);
 for(const part of parts){assert(entries.some(e=>e.partId===part.id));if(part.category==='case')for(const view of ['side','rear'])assert(entries.some(e=>e.partId===part.id&&e.view===view));}
 for(const e of entries){const file=path.join('assets/art',e.bundle,e.path+'.png'),meta=JSON.parse(fs.readFileSync(file+'.meta')),r=records.find(r=>r.partId===e.partId&&r.view===e.view);
 assert.equal(meta.userData.type,'sprite-frame');assert.equal(meta.userData.compressSettings.presetId,'orangegame_png');
 assert.deepEqual(fs.readFileSync(file),fs.readFileSync(r.figmaExportPath));assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),r.sha256);
 if(e.foregroundBandsMm)for(const band of e.foregroundBandsMm)assert(band.every(Number.isFinite)&&band[1]>=0&&band[2]>0&&band[3]>0);
 }
});
