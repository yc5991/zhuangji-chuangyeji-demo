import {DATA} from './data';
import type {ComputerDesign, Part, RequiredConnection, Connector, Role, TestReport, CaseGeometry} from './types';
import {finishing} from './finishing';

export const part = (id:string):Part => {
  const value=DATA.parts.find(p=>p.id===id);
  if(!value) throw new Error(`配件不存在：${id}`);
  return value;
};
/** Board landmarks, installed bodies and cable endpoints share case millimetres. */
export function boardPoint(design:ComputerDesign,pixels:number[]):number[] {
  const base=DATA.geometry.find(g=>g.caseId===design.case)!,layout=DATA.boardLayouts.find(b=>b.partId===design.motherboard)!;
  const size=part(design.motherboard).referenceDimensionsMm!,[left,top,right,bottom]=layout.bodyRectLtrbPx;
  return [base.tray[0]+(pixels[0]-left)/(right-left)*size.width,base.tray[1]+(bottom-pixels[1])/(bottom-top)*size.height];
}
export function geometry(design:ComputerDesign):CaseGeometry {
  const base=DATA.geometry.find(g=>g.caseId===design.case)!,layout=DATA.boardLayouts.find(b=>b.partId===design.motherboard)!;
  const board=part(design.motherboard),size=board.referenceDimensionsMm!,cpu=boardPoint(design,layout.cpuCenterPx),pcie=boardPoint(design,layout.pcieLinePx);
  const cool=part(design.cooler).game.dimensionsMm,psu=part(design.psu).game.dimensionsMm,gpu=design.gpu?part(design.gpu).game.dimensionsMm:null;
  const slots=base.slots.filter(s=>s.kind!=='ram'&&!(design.caseModules.removeHddCage&&s.bay==='3.5-inch')).map(s=>({...s,rect:[...s.rect]}));
  const body=(id:string,rect:number[])=>{slots.find(s=>s.id===id)!.rect=rect;};
  body('motherboard',[...base.tray,size.width,size.height]);
  body('cpu',[cpu[0]-19,cpu[1]-19,38,38]);
  body('cooler',[cpu[0]-cool.length/2,cpu[1]-cool.width/2,cool.length,cool.width]);
  body('gpu',[base.tray[0],pcie[1]-(gpu?.thickness||40),gpu?.length||part(design.case).game.gpuMaxLengthMm,gpu?.thickness||40]);
  body('psu',[8,4,psu.depth,psu.height]);
  layout.dimmCentersPx.forEach((p,i)=>{const c=boardPoint(design,p);slots.push({id:`ram${i}`,kind:'ram',plane:'side',rect:[c[0]-5,c[1]-67.5,10,135]});});
  return {...base,slots};
}
export function connectionLabel(id:string):string {
  const names:Record<string,string>={main_power:'主板供电',cpu_power:'处理器供电',cpu_fan:'处理器散热风扇',front_panel:'机箱前面板',hub_power:'风扇集线器供电',hub_control:'风扇集线器控制',psu_main:'电源主板供电接口',board_cpu_fan:'主板处理器风扇接口',board_case_control:'主板机箱风扇接口',case_front:'机箱前面板线束'};
  if(names[id])return names[id];
  const groups:[string,string][]=[['gpu_power_','显卡供电'],['sata_power_','硬盘供电'],['sata_data_','硬盘数据'],['case_fan_','机箱风扇'],['psu_cpu_','电源处理器供电接口'],['psu_gpu_','电源显卡供电接口'],['psu_sata_','电源储存供电接口'],['board_sata_','主板储存数据接口'],['hub_fan_','集线器风扇接口']];
  for(const [prefix,name] of groups)if(id.startsWith(prefix))return `${name} ${Number(id.slice(prefix.length))+1}`;
  return '连接接口';
}
export const bill = (design:ComputerDesign):Record<string,number> => {
  const result:Record<string,number>={};
  for(const id of [design.cpu,design.motherboard,design.gpu,design.psu,design.cooler,design.case]) if(id) result[id]=(result[id]||0)+1;
  for(const group of [design.ram,design.storage]) for(const row of group) result[row.id]=(result[row.id]||0)+row.quantity;
  return result;
};
export const instances = (design:ComputerDesign):{key:string;part:Part}[] => {
  const result=['motherboard','cpu','gpu','psu','cooler'].filter(k=>(design as any)[k]).map(k=>({key:k,part:part((design as any)[k])}));
  for(const [prefix,group] of [['ram',design.ram],['disk',design.storage]] as const) {
    let index=0;
    for(const row of group) for(let i=0;i<row.quantity;i++) result.push({key:`${prefix}${index++}`,part:part(row.id)});
  }
  return result;
};
export function invalidate(design:ComputerDesign) {
  design.revision++; design.test=null; design.prototypeMade=false; design.standardized=false;
}
export function legalSlots(design:ComputerDesign,key:string):string[] {
  const instance=instances(design).find(i=>i.key===key);
  if(!instance) return [];
  const occupied=new Set(Object.entries(design.slotAssignments).filter(([k])=>k!==key).map(([,v])=>v));
  return geometry(design).slots.filter(s=>s.kind===instance.part.category && !occupied.has(s.id) &&
    (s.kind!=='ram' || Number(s.id.slice(3))<part(design.motherboard).game.ramSlots) &&
    (s.kind!=='storage' || s.bay===instance.part.game.bayType) &&
    !(design.caseModules.removeHddCage && s.bay==='3.5-inch')).map(s=>s.id);
}
/** Expanded touch targets do not enlarge physical bodies or bypass compatibility and occupancy. */
export function nearestSlot(design:ComputerDesign,key:string,plane:string,point:number[],minimumHitSizeMm=0):string|null {
  const legal=new Set(legalSlots(design,key));
  const candidates=geometry(design).slots.filter(s=>s.plane===plane&&legal.has(s.id)).map(s=>{
    const [x,y,w,h]=s.rect,cx=x+w/2,cy=y+h/2;
    return {id:s.id,cx,cy,hw:Math.max(w,minimumHitSizeMm)/2,hh:Math.max(h,minimumHitSizeMm)/2};
  }).filter(s=>Math.abs(point[0]-s.cx)<=s.hw&&Math.abs(point[1]-s.cy)<=s.hh);
  candidates.sort((a,b)=>Math.hypot(point[0]-a.cx,point[1]-a.cy)-Math.hypot(point[0]-b.cx,point[1]-b.cy));
  return candidates[0]?.id||null;
}
export function install(design:ComputerDesign,key:string,slot:string) {
  if(!legalSlots(design,key).includes(slot)) throw new Error('这个安装位不适合该部件，或已被占用');
  if(design.slotAssignments[key]!==slot) {design.slotAssignments[key]=slot; invalidate(design);}
}
/** Detach dependent parts and their connections; configuration and owned inventory are preserved. */
export function uninstall(design:ComputerDesign,key:string,updateRevision=true):string[] {
  if(!instances(design).some(i=>i.key===key))throw new Error('这个部件不存在');
  const keys=new Set([key]);
  if(key==='motherboard')for(const i of instances(design))if(['cpu','cooler','gpu','ram'].includes(i.part.category))keys.add(i.key);
  if(key==='cpu')keys.add('cooler');
  const removed=Array.from(keys).filter(k=>!!design.slotAssignments[k]);
  for(const k of keys)delete design.slotAssignments[k];
  const previousRoutes=design.cableRoutes.length;
  design.cableRoutes=design.cableRoutes.filter(r=>{
    if(keys.has('motherboard'))return false;
    if(keys.has('psu')&&r.from.startsWith('psu_'))return false;
    if(keys.has('cooler')&&r.to==='cpu_fan')return false;
    if(keys.has('gpu')&&r.to.startsWith('gpu_power_'))return false;
    if(r.to.startsWith('sata_')){const index=r.to.slice(r.to.lastIndexOf('_')+1);if(keys.has(`disk${index}`))return false;}
    return true;
  });
  if(updateRevision&&(removed.length||previousRoutes!==design.cableRoutes.length))invalidate(design);return removed;
}
export function assistAssembly(design:ComputerDesign) {
  design.slotAssignments={};
  for(const instance of instances(design)) {
    const slot=legalSlots(design,instance.key)[0];
    if(slot) design.slotAssignments[instance.key]=slot;
  }
  invalidate(design);
}
export function connectors(design:ComputerDesign):Connector[] {
  const psu=part(design.psu).game, board=part(design.motherboard).game;
  const g=geometry(design), layout=DATA.boardLayouts.find(b=>b.partId===design.motherboard)!, origin=[8+psu.dimensionsMm.depth-8,4+psu.dimensionsMm.height/2];
  const sockets:Connector[]=[{id:'psu_main',role:'MAINBOARD_POWER',pins:[24],point:origin}];
  psu.cpuPowerConnectors.forEach((p:any,i:number)=>sockets.push({id:`psu_cpu_${i}`,role:p.role,pins:p.supportedPins,point:origin}));
  psu.gpuConnectors.forEach((p:any,i:number)=>sockets.push({id:`psu_gpu_${i}`,role:p.role,pins:p.supportedPins,point:origin}));
  for(let i=0;i<psu.sataPowerConnectors;i++) sockets.push({id:`psu_sata_${i}`,role:'SATA_POWER',pins:[15],point:origin});
  for(let i=0;i<board.sataPorts;i++) sockets.push({id:`board_sata_${i}`,role:'SATA_DATA',pins:[7],point:boardPoint(design,layout.connectorsPx.sata)});
  sockets.push({id:'board_cpu_fan',role:'CPU_FAN',pins:[4],point:boardPoint(design,layout.connectorsPx.cpuFan)});
  sockets.push({id:'board_case_control',role:'CASE_FAN',pins:[4],point:boardPoint(design,layout.connectorsPx.caseFan)});
  for(let i=0;i<part(design.case).game.includedFanHub.outputs;i++) sockets.push({id:`hub_fan_${i}`,role:'CASE_FAN',pins:[4],point:[g.width-55,130]});
  sockets.push({id:'case_front',role:'FRONT_PANEL',pins:[9],point:[g.width-20,g.height-35]});
  return sockets;
}
export function requirements(design:ComputerDesign):RequiredConnection[] {
  const g=geometry(design),layout=DATA.boardLayouts.find(b=>b.partId===design.motherboard)!;
  const req:RequiredConnection[]=[
    {id:'main_power',role:'MAINBOARD_POWER',pins:24,point:boardPoint(design,layout.connectorsPx.mainPower),defaultNodes:['A01','A02','A03','A04']},
    {id:'cpu_power',role:'CPU_POWER',pins:part(design.motherboard).game.cpuPowerPins,point:boardPoint(design,layout.connectorsPx.cpuPower),defaultNodes:['A01','A02','A03','A04','A05','A06']},
    {id:'cpu_fan',role:'CPU_FAN',pins:4,point:boardPoint(design,layout.cpuCenterPx),defaultNodes:[]},
    {id:'front_panel',role:'FRONT_PANEL',pins:9,point:boardPoint(design,layout.connectorsPx.frontPanel),defaultNodes:['A05','A04']},
    {id:'hub_power',role:'SATA_POWER',pins:15,point:[g.width-55,130],defaultNodes:['A01','A02','A03']},
    {id:'hub_control',role:'CASE_FAN',pins:4,point:[g.width-55,130],defaultNodes:['A04']}
  ];
  if(design.gpu) {const r=g.slots.find(s=>s.id==='gpu')!.rect;part(design.gpu).game.requiredGpuPowerPins.forEach((pins:number,i:number)=>req.push({id:`gpu_power_${i}`,role:'GPU_POWER',pins,point:[r[0]+r[2]-18,r[1]+r[3]-6],defaultNodes:['A01','A02','A03','A04','A07']}));}
  const disks=instances(design).filter(i=>i.part.category==='storage');
  disks.forEach((disk,i)=>{
    const slot=g.slots.find(s=>s.id===design.slotAssignments[disk.key]);
    const point=slot?[slot.rect[0],slot.rect[1]+30]:[g.width-80,150];
    req.push({id:`sata_power_${i}`,role:'SATA_POWER',pins:15,point,defaultNodes:['A01','A02','A03','A08']});
    req.push({id:`sata_data_${i}`,role:'SATA_DATA',pins:7,point,defaultNodes:['A03','A08']});
  });
  design.fanPositions.forEach((id,i)=>{
    const zone=g.fanZones.find(f=>f.id===id);
    if(zone) {
      const [x,y,w,h]=zone.rect;
      // The lead exits the frame's inner edge, rather than the centre of the blade sweep.
      const point=w>h?[x+w/2,y]:[x<g.width/2?x+w:x,y+h/2];
      req.push({id:`case_fan_${i}`,role:'CASE_FAN',pins:4,point,defaultNodes:point[0]<g.width/2&&point[1]>g.height/2?['A04','A05','A06']:['A04']});
    }
  });
  return req;
}
export function connect(design:ComputerDesign,requestId:string,sourceId:string,nodes:string[]) {
  const request=requirements(design).find(r=>r.id===requestId), source=connectors(design).find(s=>s.id===sourceId);
  if(!request || !source) throw new Error('连接接口不存在');
  if(request.role!==source.role || !source.pins.includes(request.pins)) throw new Error('接口角色或针脚不匹配，CPU 与显卡供电不能互换');
  if(request.id==='hub_control' && source.id!=='board_case_control') throw new Error('集线器控制线需要接到主板风扇接口');
  if(request.id.startsWith('case_fan') && !source.id.startsWith('hub_fan')) throw new Error('机箱风扇需要连接机箱集线器');
  if(design.cableRoutes.some(r=>r.to!==requestId && r.from===sourceId)) throw new Error('这个物理接口已经分配给另一条线');
  const route={id:requestId,role:request.role,from:sourceId,to:requestId,nodes:[...nodes]};
  const previous=design.cableRoutes;
  design.cableRoutes=[...previous.filter(r=>r.to!==requestId),route];
  const issues=wiringIssues(design,false);
  if(issues.length) {design.cableRoutes=previous; throw new Error(issues[0]);}
  invalidate(design);
}
export function assistRouting(design:ComputerDesign) {
  design.cableRoutes=[];
  const sources=connectors(design), used=new Set<string>();
  for(const request of requirements(design)) {
    const source=sources.find(s=>s.role===request.role && s.pins.includes(request.pins) && !used.has(s.id) &&
      (request.id==='hub_control'?s.id==='board_case_control':request.id.startsWith('case_fan')?s.id.startsWith('hub_fan'):true));
    if(source) {used.add(source.id);design.cableRoutes.push({id:request.id,role:request.role,from:source.id,to:request.id,nodes:[...request.defaultNodes]});}
  }
  invalidate(design);
}
const distance=(a:number[],b:number[])=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function crossesRect(a:number[],b:number[],rect:number[]) {
  // Segment clipping excludes rectangles that only touch a route endpoint.
  let low=0,high=1;
  const [x,y,w,h]=rect, dx=b[0]-a[0],dy=b[1]-a[1];
  for(const [p,q] of [[-dx,a[0]-x],[dx,x+w-a[0]],[-dy,a[1]-y],[dy,y+h-a[1]]]) {
    if(Math.abs(p)<1e-8) {if(q<0) return false;}
    else {const t=q/p;if(p<0) low=Math.max(low,t); else high=Math.min(high,t);}
  }
  return low<high && high>0.001 && low<0.999;
}
export function wiringIssues(design:ComputerDesign,requireComplete=true):string[] {
  const g=geometry(design), expected=requirements(design), sources=connectors(design), issues:string[]=[], usage:Record<string,number>={};
  const allocated=new Set<string>();
  for(const request of expected) {
    const routes=design.cableRoutes.filter(r=>r.to===request.id);
    if(routes.length!==1) {if(requireComplete) issues.push(`${connectionLabel(request.id)}：尚未完成连接`);continue;}
    const route=routes[0], source=sources.find(s=>s.id===route.from);
    if(!source || source.role!==request.role || route.role!==request.role || !source.pins.includes(request.pins)) {issues.push(`${connectionLabel(request.id)}：接口角色不匹配`);continue;}
    if(request.id==='hub_control'&&source.id!=='board_case_control'||request.id.startsWith('case_fan')&&!source.id.startsWith('hub_fan')) issues.push(`${connectionLabel(request.id)}：集线器连接位置不正确`);
    if(allocated.has(source.id)) issues.push(`${connectionLabel(request.id)}：物理接口重复使用`);
    allocated.add(source.id);
    const points=[source.point];
    for(let i=0;i<route.nodes.length;i++) {
      const anchor=g.anchors.find(a=>a.id===route.nodes[i]);
      if(!anchor) {issues.push(`${connectionLabel(request.id)}：固定节点不存在`);continue;}
      points.push(anchor.point);
      if(i) {
        const a=route.nodes[i-1],b=route.nodes[i];
        const channel=g.channels.find(c=>(c.from===a&&c.to===b)||(c.from===b&&c.to===a));
        if(!channel) issues.push(`${connectionLabel(request.id)}：固定节点没有相邻通道`);
        else {const key=[a,b].sort().join('-');usage[key]=(usage[key]||0)+1;if(usage[key]>channel.capacity) issues.push(`${connectionLabel(request.id)}：线束超过通道容量`);}
      }
    }
    points.push(request.point);
    const length=points.slice(1).reduce((n,p,i)=>n+distance(points[i],p),0);
    if(length>g.cableLengths[request.role]) issues.push(`${connectionLabel(request.id)}：线缆长度不足`);
    // Rear-tray channels avoid components; unrestricted direct runs must clear fan blades.
    if(!route.nodes.length && request.role!=='CPU_FAN') {
      for(const obstacle of g.keepouts)if(points.slice(1).some((p,i)=>crossesRect(points[i],p,obstacle.rect)))issues.push(`${connectionLabel(request.id)}：线缆穿过风扇扫掠区`);
      // These protruding bodies occupy the direct front-side routing plane. Rear channels bypass them.
      for(const key of ['cooler','gpu']) {
        if(key==='gpu'&&request.role==='GPU_POWER'||!design.slotAssignments[key])continue;
        const slot=g.slots.find(s=>s.id===design.slotAssignments[key]);
        if(slot&&points.slice(1).some((p,i)=>crossesRect(points[i],p,slot.rect)))issues.push(`${connectionLabel(request.id)}：直连线穿过${key==='cooler'?'散热器':'显卡'}，请改走固定点`);
      }
    }
    if(route.nodes.length && new Set(route.nodes).size!==route.nodes.length) issues.push(`${connectionLabel(request.id)}：路径重复绕行`);
  }
  for(const route of design.cableRoutes) if(!expected.some(r=>r.id===route.to)) issues.push('线缆指向已移除的接口');
  return Array.from(new Set(issues));
}
export function geometryIssues(design:ComputerDesign):string[] {
  const g=geometry(design), issues:string[]=[], assigned=new Set<string>();
  for(const instance of instances(design)) {
    const slot=design.slotAssignments[instance.key];
    if(!slot) {issues.push(`${instance.part.model}：尚未装入安装位`);continue;}
    if(!legalSlots(design,instance.key).includes(slot)) issues.push(`${instance.part.model}：安装位不兼容`);
    if(assigned.has(slot)) issues.push('两个部件占用了同一个安装位');
    assigned.add(slot);
  }
  if(design.fanCount!==design.fanPositions.length || new Set(design.fanPositions).size!==design.fanPositions.length) issues.push('风扇位置重复或数量不符');
  for(const id of design.fanPositions) if(!g.fanZones.some(f=>f.id===id)) issues.push('风扇位置不存在');
  for(const id of design.fanPositions)if(!['intake','exhaust'].includes(design.fanDirections[id]))issues.push('风扇进出风方向未正确设置');
  if(!design.fanPositions.some(id=>design.fanDirections[id]==='intake') || !design.fanPositions.some(id=>design.fanDirections[id]==='exhaust')) issues.push('风道需要至少一个进风口和一个出风口');
  if(['sealed','steel'].includes(design.caseModules.sidePanel) && design.cableRoutes.some(r=>r.nodes.includes('A07')&&r.nodes.length>7)) issues.push('线缆绕行阻碍侧板闭合');
  if(design.gpu) {
    const gpu=part(design.gpu).game,k=part(design.case).game;
    if(gpu.dimensionsMm.height>k.coolerMaxHeightMm)issues.push('显卡高度超过侧板可用空间');
    else if(gpu.requiredGpuPowerPins.length&&gpu.dimensionsMm.height+g.gpuCableBendMm>k.coolerMaxHeightMm)issues.push('显卡供电线弯折空间不足，侧板无法闭合');
  }
  const ram=instances(design).filter(i=>i.part.category==='ram');
  if(ram.some(r=>r.part.game.modelHeightMm>g.cpuRamClearanceMm) && part(design.cooler).game.dimensionsMm.height>100) issues.push('散热器与高内存条发生干涉');
  return issues;
}
function plugsMatch(required:number[],plugs:any[],role:string):boolean {
  const pool=plugs.filter(p=>p.role===role);
  const search=(i:number,used:Set<number>):boolean=>i===required.length || pool.some((p,j)=>!used.has(j)&&p.supportedPins.includes(required[i])&&search(i+1,new Set(Array.from(used).concat(j))));
  return search(0,new Set());
}
function memory(gb:number,use:string):number {
  const curve=DATA.balance.memoryCurve;
  if(gb<=curve[0].gb) return curve[0][use]*gb/curve[0].gb;
  for(let i=1;i<curve.length;i++) if(gb<=curve[i].gb) return curve[i-1][use]+(curve[i][use]-curve[i-1][use])*(gb-curve[i-1].gb)/(curve[i].gb-curve[i-1].gb);
  return curve[curve.length-1][use];
}
export function evaluate(design:ComputerDesign,date:string,physical=true):TestReport {
  const finish=finishing(design);
  const c=part(design.cpu).game,b=part(design.motherboard).game,gpu=design.gpu?part(design.gpu).game:null,p=part(design.psu).game,k=part(design.case).game,cooler=part(design.cooler).game;
  const all=Object.entries(bill(design)).flatMap(([id,q])=>Array.from({length:q},()=>part(id)));
  const ram=all.filter(p=>p.category==='ram'),disks=all.filter(p=>p.category==='storage'),blocked:string[]=[],warnings:string[]=[];
  const check=(test:boolean,reason:string)=>{if(!test) blocked.push(reason);};
  check(all.every(p=>p.release<=date),'所选配件尚未供货');
  check(b.supportedCpuIds.includes(design.cpu)&&b.platform===c.platform,'处理器与主板平台不兼容');
  check(ram.every(p=>p.game.ramType===b.ramType),'内存代际与主板不匹配');
  check(ram.length>0&&ram.length<=b.ramSlots,'内存数量超过插槽或尚未选择内存');
  const ramGB=ram.reduce((n,p)=>n+p.game.capacityGB,0);
  check(ramGB<=b.maxRamGB,'内存容量超过主板上限');
  check(k.supportedForms.includes(b.formFactor),'主板尺寸超过机箱安装范围');
  check(cooler.supportedPlatforms.includes(c.platform),'散热器没有合适的扣具');
  check(cooler.dimensionsMm.height<=k.coolerMaxHeightMm,'散热器太高，侧板无法闭合');
  check(p.dimensionsMm.depth<=k.psuMaxDepthMm,'电源深度超过电源仓');
  check(!design.caseModules.removeHddCage||k.removableHddCage,'这个机箱不能拆除硬盘架');
  check(!gpu||gpu.dimensionsMm.length<=(design.caseModules.removeHddCage?k.gpuMaxLengthWithoutCageMm:k.gpuMaxLengthMm),'显卡长度超过机箱空间');
  check(!!gpu||(c.integratedGraphicsScore!==null&&b.displayOutput),'电脑缺少可用的显示输出');
  check(plugsMatch(gpu?.requiredGpuPowerPins||[],p.gpuConnectors,'GPU_POWER'),'电源缺少独立显卡供电插头');
  check(plugsMatch([b.cpuPowerPins],p.cpuPowerConnectors,'CPU_POWER'),'电源缺少处理器供电插头');
  check(disks.length>0&&disks.length<=b.sataPorts&&disks.every(d=>d.game.interface==='SATA'),'储存接口不足或不兼容');
  for(const bay of ['2.5-inch','3.5-inch']) check(disks.filter(d=>d.game.bayType===bay).length<=(design.caseModules.removeHddCage&&bay==='3.5-inch'?0:k.storageBays[bay]),'储存安装位不足');
  check(disks.some(d=>d.id===design.systemDrive)&&disks.some(d=>d.id===design.workDrive),'系统盘或工作盘尚未正确选择');
  check(disks.length+1<=p.sataPowerConnectors,'储存与风扇集线器需要更多供电接口');
  check(Number.isInteger(design.fanCount)&&design.fanCount>=2&&design.fanCount<=k.maxFans,'风扇数量不适合机箱');
  const profile=DATA.balance.fanProfiles[design.fanProfile];
  if(!profile) throw new Error('风扇运行模式不存在');
  const load=c.designLoadW+(gpu?.designLoadW||0)+b.designLoadW+[...ram,...disks].reduce((n,p)=>n+p.game.designLoadW,0)+design.fanCount*DATA.balance.fanLoadW+k.includedFanHub.designLoadW;
  check(load<=p.ratedOutputW,'设计负载超过电源额定输出');
  const headroom=(p.ratedOutputW-load)/p.ratedOutputW;
  if(headroom<DATA.balance.powerHeadroomWarningBelow) warnings.push('电源余量偏小，升级时可能需要更换电源');
  const cpuCooling=cooler.coolingUnits*profile.cooling,caseCooling=(k.caseCoolingUnits+Math.max(0,design.fanCount-k.defaultFans)*DATA.balance.additionalFanCoolingUnits+(design.caseModules.removeHddCage?k.cageRemovalCoolingBonusUnits:0))*profile.cooling*finish.cooling;
  const coolingRatio=Math.min(1,cpuCooling/c.heatUnits,caseCooling/(c.heatUnits+(gpu?.heatUnits||0)+DATA.balance.thermal.mainboardHeatUnits));
  const throttle=Math.max(DATA.balance.thermal.throttleFloor,coolingRatio);
  if(coolingRatio<1) warnings.push('散热不足，当前性能受温度影响；增加风量会提高噪声');
  const vramFit=Math.min(1,(gpu?gpu.vramGB:DATA.balance.integratedVramBudgetGB)/DATA.balance.defaultRequiredVramGB);
  const graphics=(gpu?gpu.graphicsScore:c.integratedGraphicsScore||0)*vramFit*throttle,creation=(gpu?gpu.creationScore:c.integratedCreationScore||0)*vramFit*throttle;
  const system=part(design.systemDrive).game,work=part(design.workDrive).game,w=DATA.balance.weights;
  const workScore=DATA.balance.workDriveWeights.response*work.responseScore+DATA.balance.workDriveWeights.capacity*Math.min(1,work.capacityGB/DATA.balance.defaultWorkCapacityGB)*100;
  const round=(v:number)=>Math.round(v*100)/100;
  const scores={office:round(w.office.singleThread*c.singleThreadScore*throttle+w.office.memory*memory(ramGB,'office')+w.office.response*system.responseScore),gaming:round(w.gaming.singleThread*c.singleThreadScore*throttle+w.gaming.graphics*graphics+w.gaming.memory*memory(ramGB,'gaming')+w.gaming.response*system.responseScore),creation:round(w.creation.multiThread*c.multiThreadScore*throttle+w.creation.creationAcceleration*creation+w.creation.memory*memory(ramGB,'creation')+w.creation.workDrive*workScore)};
  const noise=round(((cooler.noiseBurden+(gpu?.noiseBurden||0)+design.fanCount*DATA.balance.fanNoiseBurden)*profile.noise+p.noiseBurden+disks.reduce((n,p)=>n+p.game.noiseBurden,0))*k.noiseMultiplier*finish.noise);
  if(physical) blocked.push(...geometryIssues(design),...wiringIssues(design));
  const frontRoutes=design.cableRoutes.filter(r=>r.nodes.length===0&&r.role.includes('POWER')).length;
  const tidiness=Math.max(0,100-frontRoutes*12-blocked.filter(r=>r.includes('线')).length*10);
  const appearance=finish.appearance;
  const partsCost=all.reduce((n,p)=>n+p.game.basePriceCoins,0)+Math.max(0,design.fanCount-k.defaultFans)*DATA.balance.additionalFanCostCoins;
  const dim=(id:string)=>DATA.evaluation.dimensions.find(d=>d.id===id)!,clamp=(n:number)=>Math.min(1,Math.max(0,n)),thermal=dim('thermals');
  const target=design.kind==='gaming'?'gaming':design.kind==='premium'?'creation':'office',budget=DATA.balance.recipes.find(r=>r.id===design.kind)!.budgetCoins[1];
  // The six dimensions are reported on the five-point scale the player sees. Internally each is still
  // worked out out of a hundred and mapped at the boundary, so the balance behind them is unchanged:
  // the scale is presentation, and only the appearance score enters a buying decision.
  const scoreRange=DATA.evaluation.scoreRange as [number,number];
  const [bandLo,bandHi]=scoreRange,bound=(n:number)=>Math.round((bandLo+(bandHi-bandLo)*clamp(n/100))*10)/10;
  const dimensionScores={useCase:bound(scores[target]),performance:bound(100*clamp(Object.values(scores).reduce((n,v)=>n+v,0)/dim('performance').reference!)),
    thermals:bound(Math.min(100,(coolingRatio>=1?thermal.stableFloor!+(100-thermal.stableFloor!)*clamp(headroom/thermal.headroomReference!):(thermal.stableFloor!-20)*clamp(headroom/thermal.headroomReference!))*finish.cooling)),
    noise:bound(100*(1-clamp(noise/dim('noise').reference!))),appearance:bound(appearance),cost:bound(100*(1-clamp(partsCost/budget)))};
  return {revision:design.revision,blocked:Array.from(new Set(blocked)),warnings,scores,noise,load,headroom:round(headroom),coolingRatio:round(coolingRatio),ramGB,storageGB:disks.reduce((n,p)=>n+p.game.capacityGB,0),partsCost,appearance,tidiness,dimensionScores,
    feedback:[`办公 ${scores.office} / 游戏 ${scores.gaming} / 创作 ${scores.creation}，均为游戏评分`,`内存 ${ramGB}GB，系统响应取决于 ${part(design.systemDrive).model}`,`负载 ${load}W / 电源 ${p.ratedOutputW}W，余量 ${Math.round(headroom*100)}%`,`噪声负担 ${noise}，风道稳定度 ${Math.round(coolingRatio*100)}%`,`理线整洁度 ${tidiness}，外观 ${Math.round(appearance)}`,`工艺：${finish.level.zh}；外观选项：${finish.options.map(o=>o.zh).join('、')}`,...warnings]};
}
