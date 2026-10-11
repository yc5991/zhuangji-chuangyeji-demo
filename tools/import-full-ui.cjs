// Losslessly unpack the atlas actually exported from the Figma editor.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),sharp=require(require.resolve('sharp',{paths:[process.env.ORANGE_ART_NODE_MODULES||'']}));
(async()=>{
 const plan=JSON.parse(fs.readFileSync(path.join(root,'art/figma/full-ui-slice-plan-v03.json'),'utf8')),atlas=path.join(root,plan.atlas.exportPath),meta=await sharp(atlas).metadata();
 if(meta.width!==plan.atlas.width||meta.height!==plan.atlas.height||!meta.hasAlpha)throw new Error('Figma atlas dimensions or alpha do not match the slicing plan.');
 const entries=[],runtime={};
 for(const e of plan.entries){const [left,top,width,height]=e.atlasRect,pixels=await sharp(atlas).extract({left,top,width,height}).png().toBuffer(),dir=e.kind==='surface'?'surfaces':'portraits';
  const exportPath=`art/exports/ui/full-v03/${dir}/${e.name}.png`,runtimePath=`assets/art/workbench/ui/full-v03/${dir}/${e.name}.png`;
  for(const file of [exportPath,runtimePath]){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),pixels);}
  const mp=path.join(root,runtimePath+'.meta');if(fs.existsSync(mp)){const m=JSON.parse(fs.readFileSync(mp,'utf8'));m.userData={...m.userData,type:'sprite-frame'};for(const sub of Object.values(m.subMetas||{}))if(sub.importer==='sprite-frame')sub.userData={...sub.userData,trimX:0,trimY:0,width,height,rawWidth:width,rawHeight:height,offsetX:0,offsetY:0,trimType:'none',borderLeft:e.border[0],borderTop:e.border[1],borderRight:e.border[2],borderBottom:e.border[3]};fs.writeFileSync(mp,JSON.stringify(m,null,2)+'\n');}
  entries.push({...e,exportPath,runtimePath,exportPx:[width,height],sha256:crypto.createHash('sha256').update(pixels).digest('hex')});runtime[`full-v03/${dir}/${e.name}`]={path:`ui/full-v03/${dir}/${e.name}`,border:e.border};
 }
 const ledger={schemaVersion:1,clientDate:'2026-10-11',fileKey:plan.fileKey,figmaNodeId:'39:2',figmaUrl:`https://www.figma.com/design/${plan.fileKey}?node-id=39-2`,method:'Untouched generated bitmap fills with editable SVG crop masks imported into ordinary Figma editor; actual 1x transparent PNG export; fixed-rectangle lossless unpack',importSvg:'art/figma/full-ui-atlas-v03.svg',atlasExport:plan.atlas.exportPath,originalsPreserved:true,sources:plan.sources,entries};
 fs.writeFileSync(path.join(root,'art/figma/full-ui-slicing-v03.json'),JSON.stringify(ledger,null,2)+'\n');
 fs.writeFileSync(path.join(root,'assets/scripts/ui-art.ts'),'// Generated from actual Figma exports by tools/import-full-ui.cjs.\nexport const UI_SKIN:Record<string,{path:string;border:number[]}>= '+JSON.stringify(runtime,null,2)+';\n');
 console.log(`Imported ${entries.length} Figma UI exports and recorded their source pixels and slice borders.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
