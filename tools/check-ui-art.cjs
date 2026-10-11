const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p)),hash=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
const ledger=JSON.parse(read('art/figma/full-ui-slicing-v03.json'));
assert.equal(ledger.figmaNodeId,'39:2');assert.equal(ledger.originalsPreserved,true);assert.equal(ledger.entries.length,22);
for(const item of ledger.sources)assert.equal(hash(item.path),item.sha256,`Source artwork changed: ${item.path}`);
const uuids=new Set();for(const item of ledger.entries){
  assert(item.runtimePath.startsWith('assets/art/workbench/ui/full-v03/'));
  assert(read(item.runtimePath).equals(read(item.exportPath)),`Runtime differs from Figma export: ${item.name}`);
  const pixels=read(item.runtimePath);assert.deepEqual([pixels.readUInt32BE(16),pixels.readUInt32BE(20)],item.exportPx);
  const meta=JSON.parse(read(item.runtimePath+'.meta'));assert.equal(meta.importer,'image');assert(!uuids.has(meta.uuid));uuids.add(meta.uuid);
  const frame=Object.values(meta.subMetas||{}).find(m=>m.importer==='sprite-frame');
  if(frame){assert.equal(frame.userData.rawWidth,item.exportPx[0]);assert.equal(frame.userData.rawHeight,item.exportPx[1]);}
}
const script=read('assets/scripts/Orangegame.ts').toString();assert(script.includes("import {UI_SKIN}"));assert(script.includes('Object.keys(UI_SKIN)'));assert(!script.includes("load('art/source"));
const pages=['start','workshop','designs','workbench','market','orders','company','inventory','feedback','templates','reports','reportNotes','ending'];
const definition=JSON.parse(read('design/ui-system.json'));assert.deepEqual(new Set(definition.screens),new Set(pages));
console.log(JSON.stringify({status:'passed',figmaNode:ledger.figmaNodeId,exports:ledger.entries.length,sourceHashesVerified:ledger.sources.length,uniqueAssetUuids:uuids.size,screenCoverage:pages.length,engineVersion:JSON.parse(read('package.json')).creator.version},null,2));
