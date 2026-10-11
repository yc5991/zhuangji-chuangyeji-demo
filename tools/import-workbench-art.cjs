const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const registry=read('design/art-runtime.json'),figmaExports=read('art/figma/exports.json').entries,parts=read('design/components.json').parts;
const clearance=read('art/figma/case-clearance-review.json').entries;
const entries=[],records=[];
const previousReview=fs.existsSync(path.join(root,'art/figma/workbench-runtime-review.json'))?read('art/figma/workbench-runtime-review.json'):{};
for(const p of parts){
 const shared=p.id.startsWith('cpu_')&&p.id!=='cpu_fx8350'?'cpu_6500':p.id.startsWith('ssd_')?'ssd_250':p.id==='psu_350'?'psu_450':p.id;
 for(const view of ['side','rear']){
  const source=figmaExports.find(e=>e.partId===shared&&e.view===view);if(!source)continue;
  const runtimePath=`${view}/${shared}`,from=path.join(root,source.stagingPath),to=path.join(root,'assets/art/workbench',runtimePath+'.png');
  fs.mkdirSync(path.dirname(to),{recursive:true});if(!fs.existsSync(to)||!fs.readFileSync(to).equals(fs.readFileSync(from)))fs.copyFileSync(from,to);
  const metadataPath=to+'.meta';
  const metadata=fs.existsSync(metadataPath)?JSON.parse(fs.readFileSync(metadataPath,'utf8')):{ver:'1.0.27',importer:'image',imported:true,uuid:crypto.randomUUID(),files:[],subMetas:{},userData:{type:'sprite-frame'}};
  metadata.userData={...metadata.userData,compressSettings:{useCompressTexture:true,presetId:'orangegame_png'}};
  fs.writeFileSync(metadataPath,JSON.stringify(metadata,null,2)+'\n');
  const entry={partId:p.id,view,bundle:'workbench',path:runtimePath,state:'reviewed',reviewScope:'fixed-view-rendering-body-alignment-and-foreground-occlusion; physical-3d-collision-not-approved',outlinePx:source.outlinePx,pivot:source.pivot,bodyRectLtrbPx:source.bodyRectLtrbPx,exportPx:source.exportPx};
  if(p.category==='case'){
   const measure=clearance.find(e=>e.partId===p.id),finding=measure.findings.find(f=>f.view===view),[l,t,r,b]=finding.bodyRectLtrbPx,[top,bottom]=finding.separatorEstimatedSourceYRangePx;
   entry.foregroundBandsMm=[[0,measure.caseMm[1]*(b-bottom)/(b-t),measure.caseMm[0],measure.caseMm[1]*(bottom-top)/(b-t)]];
  }
  entries.push(entry);records.push({partId:p.id,view,sharedArtworkFrom:shared,figmaExportPath:source.stagingPath,runtimePath:'assets/art/workbench/'+runtimePath+'.png',figmaNodeId:source.figmaExportNodeId||source.exportNodeId,sha256:crypto.createHash('sha256').update(fs.readFileSync(from)).digest('hex'),bodyRectLtrbPx:entry.bodyRectLtrbPx});
 }
 if(p.category==='case'){
  const product=registry.entries.find(e=>e.partId===p.id&&e.view==='product');entries.push({...product,view:'exterior',fit:'contain',reviewScope:'exterior-display-reuses-procurement-view; finish-and-panel-variants-pending'});
 }
}
const unchanged=JSON.stringify(records)===JSON.stringify(previousReview.entries||[]);
registry.entries=[...registry.entries.filter(e=>e.view==='product'),...entries];registry.status='procurement_and_fixed_view_art_integrated_joint_visual_review';
fs.writeFileSync(path.join(root,'design/art-runtime.json'),JSON.stringify(registry,null,2)+'\n');
fs.writeFileSync(path.join(root,'art/figma/workbench-runtime-review.json'),JSON.stringify({schemaVersion:1,importedAt:new Date().toISOString(),method:'Import exact Figma PNG pixels and map measured bodies into existing physical slots; reviewScope is limited to fixed-view rendering.',runtimeVerification:unchanged?(previousReview.runtimeVerification||null):null,boundary:'Runtime display review does not approve full 3D collision, fan animation or exterior customization textures.',entries:records},null,2)+'\n');
console.log(`${entries.length} fixed-view records imported; ${records.length} installation mappings. Existing metadata UUIDs retained.`);
