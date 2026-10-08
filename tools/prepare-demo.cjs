// Export only approved Demo inputs and original geometry, keeping research outside runtime assets.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const write = (file, value) => {
  const target = path.join(root,file);
  fs.mkdirSync(path.dirname(target), {recursive:true});
  const contents = typeof value === 'string' ? value : JSON.stringify(value,null,2)+'\n';
  if (!fs.existsSync(target) || fs.readFileSync(target,'utf8') !== contents) fs.writeFileSync(target,contents);
};
const sourceFiles = ['components.json','balance.json','economy-candidate.json','supplier-system.json','customer-model.json','workbench.json','market-events.json','demo-schedule.json','design-flow.json','evaluation.json','finish-options.json','case-options.json','cable-routing.json','reliability-model.json','staff.json','era-trends.json','company-progression.json'];
const fingerprints = Object.fromEntries(sourceFiles.map(file => [file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'design',file))).digest('hex')]));
const components = read('design/components.json');
const cases = components.parts.filter(p=>p.category==='case');
const geometries = cases.map(part => {
  const {height:h,depth:w} = part.game.dimensionsMm;
  const trayY = part.id === 'case_small' ? 90 : 110;
  const boardW = part.id === 'case_small' ? 183 : 229;
  const boardH = part.id === 'case_small' ? 226 : 305;
  const trayX = 20;
  const slots = [
    {id:'motherboard',kind:'motherboard',rect:[trayX,trayY,boardW,boardH],plane:'side'},
    {id:'cpu',kind:'cpu',rect:[trayX+70,trayY+130,38,38],plane:'side'},
    {id:'cooler',kind:'cooler',rect:[trayX+38,trayY+109,120,80],plane:'side'},
    {id:'gpu',kind:'gpu',rect:[trayX,trayY+35,part.game.gpuMaxLengthMm,40],plane:'side'},
    {id:'psu',kind:'psu',rect:[8,4,part.game.psuMaxDepthMm,86],plane:'side'}
  ];
  for(let i=0;i<4;i++) slots.push({id:`ram${i}`,kind:'ram',rect:[trayX+163+i*13,trayY+86,10,135],plane:'side'});
  for(let i=0;i<2;i++) slots.push({id:`ssd${i}`,kind:'storage',bay:'2.5-inch',rect:[w-80,101+i*107,70,100],plane:'rear'});
  for(let i=0;i<part.game.storageBays['3.5-inch'];i++) slots.push({id:`hdd${i}`,kind:'storage',bay:'3.5-inch',rect:[w-115,4+i*39,100,35],plane:'side'});
  const fanZones = [
    {id:'fan0',rect:[w-20,105,16,120],direction:'intake',plane:'side'},
    {id:'fan1',rect:[2,h-132,16,120],direction:'exhaust',plane:'side'},
    {id:'fan2',rect:[w-142,h-18,120,16],direction:'exhaust',plane:'side'},
    {id:'fan3',rect:[w-20,h-125,16,110],direction:'intake',plane:'side'},
    {id:'fan4',rect:[24,h-18,110,16],direction:'exhaust',plane:'side'}
  ].slice(0,part.game.maxFans);
  const points = {A01:[180,49],A02:[185,94],A03:[w-100,94],A04:[w-45,trayY+115],A05:[w-45,h-25],A06:[60,h-25],A07:[w-45,trayY+53],A08:[w-70,155]};
  if(part.id==='case_small') {points.A01=[150,49]; points.A02=[155,94]; points.A03=[w-95,94];}
  const edges = [['A01','A02'],['A02','A03'],['A03','A04'],['A04','A05'],['A05','A06'],['A04','A07'],['A03','A08']];
  return {caseId:part.id,width:w,height:h,units:'mm',tray:[trayX,trayY],slots,fanZones,
    anchors:Object.entries(points).map(([id,point])=>({id,point,plane:['A02','A03','A05','A08'].includes(id)?'rear':'side'})),
    channels:edges.map(([from,to])=>({from,to,capacity:24})),
    keepouts:fanZones.map(f=>({id:f.id,rect:f.rect,plane:'side'})),
    cableLengths:{MAINBOARD_POWER:1600,CPU_POWER:1800,GPU_POWER:1400,SATA_POWER:1500,SATA_DATA:800,CPU_FAN:650,CASE_FAN:1300,FRONT_PANEL:1400},
    cpuRamClearanceMm:34,gpuCableBendMm:15};
});
write('design/workbench-geometry.json',{schemaVersion:1,status:'implemented_game_geometry',provenance:'Original fixed-view game geometry derived from selected game case envelopes; not verified manufacturer internals.',cases:geometries});
const balance = read('design/balance.json');
const workbench = read('design/workbench.json');
const baseline = {recordedDate:'2026-10-08',creatorVersion:'3.8.8',sourceHashes:fingerprints,scope:{firstMonth:'2016-01',lastMonth:'2016-06',purchaseEntries:32,cloudSaves:false,views:['side','rear','exterior']},budgetBytes:{main:3500000,total:20000000}};
write('design/demo-baseline.json',baseline);
const data = {
  baseline,
  parts:components.parts.map(p=>({id:p.id,category:p.category,brandId:p.brandId,seriesId:p.seriesId,model:p.model,displayName:p.displayName,release:p.availability.gameDate,game:p.game})),
  balance,economy:read('design/economy-candidate.json'),customers:read('design/customer-model.json'),channels:read('design/supplier-system.json').channels,geometry:geometries,
  marketEvents:read('design/market-events.json').events,schedule:read('design/demo-schedule.json').months,
  events:workbench.eventDates.map(e=>({...e,title:e.action==='forecast_only'?'老黄的新卡发布会快到了，采购前留意供货日':'新配件开始供货，旧机型仍能继续销售'}))
};
const artwork=read('design/art-runtime.json');
for(const entry of artwork.entries) {
  if(!['reviewed','approved'].includes(entry.state)) throw new Error(`Runtime artwork has not passed review: ${entry.partId}`);
  if(!entry.outlinePx||entry.outlinePx.length!==4||!entry.pivot||entry.pivot.length!==2) throw new Error(`Artwork outline or pivot missing: ${entry.partId}`);
  if(!fs.existsSync(path.join(root,'assets/art',entry.bundle,entry.path+'.png'))) throw new Error(`Artwork export missing: ${entry.path}`);
}
write('assets/scripts/runtime-art.ts',`// Generated from reviewed Figma exports.\nimport type {RuntimeArt} from './domain/types';\nexport const ART:RuntimeArt[]=${JSON.stringify(artwork.entries,null,2)};\n`);
write('assets/scripts/domain/data.ts',`// Generated by tools/prepare-demo.cjs from design inputs; do not edit prices here.\nimport type { GameData } from './types';\nexport const DATA: GameData = ${JSON.stringify(data,null,2)};\n`);
// Preserve any existing importer UUID; only create missing adjacent metadata.
function metaTree(dir) {
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if(entry.name.endsWith('.meta') || entry.name==='.gitkeep') continue;
    const full=path.join(dir,entry.name);
    const meta=full+'.meta';
    if(!fs.existsSync(meta)) {
      const importer=entry.isDirectory()?'directory':entry.name.endsWith('.ts')?'typescript':entry.name.endsWith('.json')?'json':'image';
      fs.writeFileSync(meta,JSON.stringify({ver:importer==='directory'?'1.2.0':importer==='typescript'?'4.0.24':importer==='json'?'1.0.0':'1.0.27',importer,imported:true,uuid:crypto.randomUUID(),files:[],subMetas:{},userData:{}},null,2)+'\n');
    }
    if(entry.isDirectory()) metaTree(full);
  }
}
metaTree(path.join(root,'assets'));
console.log(`Demo exported: ${data.parts.length} parts, ${geometries.length} cases; reference catalog excluded.`);
