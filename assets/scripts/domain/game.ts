import {DATA} from './data';
import type {GameState, Difficulty, ProductKind, ComputerDesign, CustomerOrder, ScheduledJob, ResourceUsage, MonthReport, FinishedUnit,RandomAdapter,DemandAssessment} from './types';
import {part,bill,evaluate,geometry,instances,install,uninstall,connect,assistAssembly,assistRouting,invalidate} from './workbench';
import {SEEDED_RANDOM,categoryPriceFactor,updateMarket} from './market';
import {failureRate,escapeRate,reworkCost,escapeCost} from './reliability';
import {businessSummary} from './summary';
import {finishing,finishWork} from './finishing';
import {monthAmounts,salesRefund,successfulUnit} from './accounting';

const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
const emptyUsage=():ResourceUsage=>({labor:0,owner:0,bench:0,test:0});
const requireThat=(condition:unknown,message:string):void=>{if(!condition) throw new Error(message);};
type ReworkJob = ScheduledJob & {reuseUnitId?:string;components?:FinishedUnit['components']};

/** One authoritative ledger handles interactive play, acceleration and offline work. */
export class Game {
  state:GameState;
  readonly data=DATA;
  constructor(state?:GameState,name='橙序电脑',difficulty:Difficulty='normal',now=Date.now(),private randomSource:RandomAdapter=SEEDED_RANDOM) {
    if(state) {this.state=this.upgradeState(state);this.validateState(this.state);if(!this.state.closed)updateMarket(this.state,DATA.marketEvents,()=>this.random());return;}
    const opening=DATA.economy.opening[difficulty];
    this.state={schemaVersion:2,baseline:clone(DATA.baseline.sourceHashes),companyName:name.trim().slice(0,18)||'橙序电脑',difficulty,
      month:1,elapsed:0,sequence:0,seed:Math.floor(now)>>>0,cash:opening.cash,employees:opening.employees,benches:opening.benches,testStations:opening.testStations,
      investments:[],reputation:DATA.customers.reputation.initial,ratingSum:0,ratingCount:0,inventory:[],purchases:[],jobs:[],designs:[],customers:[],finished:[],transactions:[],reports:[],used:emptyUsage(),soldThisMonth:{},supplierStock:{},seenEvents:[],
      pendingNews:['欢迎来到一月。可以开发自己的产品，也可以接受高定委托；完成样机测试后交付或投产。'],marketRecords:[],tutorial:[],closed:false,bankrupt:false,lastWallTime:now};
    this.refreshMonth();
  }
  private upgradeState(input:GameState):GameState {
    requireThat(input.schemaVersion===1||input.schemaVersion===2,'存档版本不受支持');
    const state=clone(input);
    if(state.schemaVersion===1) {
      state.schemaVersion=2;state.marketRecords=[];state.tutorial=[];
      if(state.designs?.length)state.tutorial.push('basic_config');
      if(state.purchases?.length)state.tutorial.push('procurement');
      if(state.finished?.length)state.tutorial.push('prototyping','testing');
      if(state.reports?.length)state.tutorial.push('monthly_settlement');
      for(const report of state.reports||[]) {
        const units=(state.finished||[]).filter(u=>(state.transactions||[]).some(t=>t.id===`${u.id}:sale`&&t.month===report.month));
        Object.assign(report,{feedback:[],stockCost:null,payables:null,standardSold:units.filter(u=>!u.customerId).length,commissionSold:units.filter(u=>!!u.customerId).length});
      }
    }
    // Additive v2 fields preserve original transactions, cash and historical profit.
    for(const unit of state.finished||[]) if(unit.status==='sold'&&!unit.deliveryOutcome) {
      if(state.transactions.some(t=>t.id===`${unit.id}:refund`&&salesRefund(t)))unit.deliveryOutcome='arrival_defect';
      else if(state.transactions.some(t=>t.id===`${unit.id}:sale`))unit.deliveryOutcome='delivered';
    }
    for(const customer of state.customers||[]) if(customer.status==='completed'&&!customer.deliveryOutcome) {
      const unit=state.finished.find(u=>u.customerId===customer.id&&u.status==='sold');
      if(unit?.deliveryOutcome)customer.deliveryOutcome=unit.deliveryOutcome;
    }
    for(const report of state.reports||[]) {
      const amounts=monthAmounts(state.transactions.filter(t=>t.month===report.month));
      if(report.salesRefunds===undefined)report.salesRefunds=amounts.salesRefunds;
      if(report.logisticsCosts===undefined)report.logisticsCosts=amounts.logisticsCosts;
      if(report.depositRefunds===undefined)report.depositRefunds=amounts.depositRefunds;
      if(report.legacyAccounting===undefined)report.legacyAccounting=amounts.legacyAccounting;
    }
    return state;
  }
  private validateState(s:GameState) {
    requireThat(s.schemaVersion===2,'存档版本不受支持');
    requireThat(Number.isInteger(s.month)&&s.month>=1&&s.month<=6&&Number.isFinite(s.cash)&&Number.isFinite(s.elapsed)&&s.elapsed>=0&&s.elapsed<=DATA.economy.stationMonthlyHours,'存档公司状态损坏');
    for(const key of ['inventory','purchases','jobs','designs','customers','finished','transactions','reports','seenEvents','pendingNews','marketRecords','tutorial'] as const) requireThat(Array.isArray(s[key]),`存档缺少 ${key}`);
    requireThat(new Set(s.transactions.map(t=>t.id)).size===s.transactions.length,'存档含重复事务');
    for(const d of s.designs) this.validateDesign(d);
    for(const lot of s.inventory) requireThat(Number.isInteger(lot.quantity)&&lot.quantity>=0&&lot.reserved>=0&&lot.reserved<=lot.quantity&&Number.isFinite(lot.unitCost),'存档库存损坏');
    requireThat(new Set(s.marketRecords.map(r=>r.id)).size===s.marketRecords.length,'存档含重复市场结果');
    for(const record of s.marketRecords)requireThat(Number.isFinite(record.multiplier)&&record.multiplier>0&&Array.isArray(record.categories)&&record.resolveMonth<=record.throughMonth,'存档市场结果损坏');
  }
  private validateDesign(d:ComputerDesign) {
    for(const [key,category] of [['cpu','cpu'],['motherboard','motherboard'],['psu','psu'],['cooler','cooler'],['case','case']] as const) requireThat(part(d[key]).category===category,'设计中的部件类别不正确');
    if(d.gpu) requireThat(part(d.gpu).category==='gpu','显卡类别不正确');
    for(const [group,category] of [[d.ram,'ram'],[d.storage,'storage']] as const) for(const row of group) requireThat(part(row.id).category===category&&Number.isInteger(row.quantity)&&row.quantity>0&&row.quantity<=8,'配件数量必须是合理的整数');
    requireThat(Number.isFinite(d.price)&&d.price>0&&DATA.economy.products[d.kind],'设计定价或定位无效');
    finishing(d);
  }
  id(prefix:string) {return `${prefix}_${++this.state.sequence}`;}
  get monthHours() {return DATA.economy.stationMonthlyHours;}
  get outstandingCredit() {return this.state.purchases.filter(p=>!p.paid).reduce((n,p)=>n+p.unitCost*p.quantity,0);}
  get creditLimit() {return DATA.economy.opening[this.state.difficulty].creditLimitCoins;}
  get startingRoutes() {return DATA.economy.opening[this.state.difficulty].startingRoutes;}
  get monthContent() {return DATA.schedule.find(m=>m.month===this.state.month)!;}
  get monthGuide() {
    return [
      '设计第一台电脑，采购缺件，完成样机测试后销售或交付。',
      '试着修改已有方案。测试会解释用途、温度和噪声的变化。',
      '不同客户需要不同的电脑。留意报价预兆，提前备货也会占用资金。',
      '查看市场消息和新报价，可以调整配置、售价或采购安排。',
      this.state.difficulty==='hard'?'可以投资精品工具，也可以考虑招人，留意每月工资。':'比较精品工具、工位和半自动设备，按产品方向安排投入。',
      '检验投资后的交付能力，处理库存与委托，再查看品牌经营记录。'
    ][this.state.month-1];
  }
  get summary() {return businessSummary(this.state);}
  private taught(subject:string) {if(!this.state.tutorial.includes(subject))this.state.tutorial.push(subject);}
  get absoluteHours() {return (this.state.month-1)*this.monthHours+this.state.elapsed;}
  get date() {
    const days=new Date(Date.UTC(2016,this.state.month,0)).getUTCDate();
    const day=Math.min(days,Math.floor(this.state.elapsed/this.monthHours*days)+1);
    return `2016-${String(this.state.month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  get fixedCost() {
    const opening=DATA.economy.opening[this.state.difficulty];
    return opening.rent+opening.utilities+this.state.employees*DATA.economy.employee.monthlySalary+
      this.state.investments.reduce((n,id)=>n+(DATA.economy.investments[id].additionalMonthlyUtilities||0),0);
  }
  get capacity():ResourceUsage {
    const opening=DATA.economy.opening[this.state.difficulty];
    return {labor:opening.ownerHours+this.state.employees*DATA.economy.employee.monthlyLaborHours,owner:opening.ownerHours,bench:this.state.benches*this.monthHours,test:this.state.testStations*this.monthHours};
  }
  private active() {requireThat(!this.state.closed,'本次经营已经结束，可以继续查看作品或建立新公司');}
  private post(id:string,kind:string,cash:number,cost:number,note:string) {
    if(this.state.transactions.some(t=>t.id===id)) return false;
    this.state.transactions.push({id,month:this.state.month,at:this.absoluteHours,kind,cash,cost,note});
    this.state.cash+=cash;
    return true;
  }
  private random() {const result=this.randomSource.next(this.state.seed);requireThat(result.value>=0&&result.value<1&&Number.isInteger(result.seed),'随机数适配器返回无效结果');this.state.seed=result.seed;return result.value;}
  private refreshMonth() {
    this.state.supplierStock={};this.state.soldThisMonth={};this.state.used=emptyUsage();
    for(const p of DATA.parts) for(const channel of DATA.channels) this.state.supplierStock[`${p.id}:${channel.id}`]=channel.nominalBatchStockUnits;
    updateMarket(this.state,DATA.marketEvents,()=>this.random());
    this.state.pendingNews.push(`${this.state.month} 月 · ${this.monthContent.zh}\n${this.monthGuide}`);
    // Customer budgets are copied at creation and remain fixed through procurement changes.
    for(const kind of ['quiet_office','premium'] as const) {
      const count=DATA.economy.companyDemandCaps[kind][this.state.month-1];
      for(let i=0;i<count;i++) {
        const a=DATA.customers.archetypes.find(a=>a.referenceRecipe===kind)!, r=a.requirements;
        const budget=Math.round(a.budgetCoins[0]+this.random()*(a.budgetCoins[1]-a.budgetCoins[0]));
        this.state.customers.push({id:this.id('customer'),archetype:a.id,kind,name:`${a.zh} · ${i+1}`,budget,
          minimumScores:clone(r.minimumScores),maxNoise:r.maximumNoiseBurden,minRam:r.minimumRamGB||0,minStorage:r.minimumStorageGB||0,
          discreteGpu:r.requiredDiscreteGpu,minVram:r.minimumVramGB||0,
          color:this.random()<.5?'graphite':'silver',dueMonth:this.state.month,status:'open',designId:null,satisfaction:null,agreedPrice:null,deposit:0});
      }
    }
  }
  acknowledgeNews() {this.state.pendingNews=[];}
  design(id:string) {const d=this.state.designs.find(d=>d.id===id);requireThat(d,'找不到这个设计');return d!;}
  createDesign(kind:ProductKind,name?:string):ComputerDesign {
    this.active();
    // Every difficulty opens all three routes: which one to run is the player's decision, not a gate.
    // Hard mode needs no lock because the opening economy already rejects mass production -- taking it
    // loses the first month -- so the player discovers the same thing by trying it.
    const recipe=DATA.balance.recipes.find(r=>r.id===kind)!;
    const d:ComputerDesign={...clone(recipe),id:this.id('design'),name:name?.trim().slice(0,28)||`${recipe.name} ${this.state.designs.length+1}`,kind,revision:1,
      slotAssignments:{},cableRoutes:[],caseModules:{panel:'solid',sidePanel:'steel',removeHddCage:false,nameplate:this.state.companyName},colors:{body:'graphite',cables:'black'},lighting:'off',finishLevelId:'standard',
      fanCount:part(recipe.case).game.defaultFans,fanPositions:['fan0','fan1'],fanDirections:{fan0:'intake',fan1:'exhaust'},fanProfile:'balanced',price:DATA.economy.products[kind].salePrice,
      test:null,prototypeMade:false,standardized:false};
    this.state.designs.push(d);this.taught('basic_config');return d;
  }
  copyDesign(id:string) {this.active();const d=clone(this.design(id));d.id=this.id('design');d.name+=' 改型';d.prototypeMade=false;d.standardized=false;this.state.designs.push(d);return d;}
  changePart(designId:string,category:string,partId:string|null,quantity=1) {
    this.active();const d=this.design(designId),draft=clone(d);
    requireThat(partId===null&&category==='gpu'||partId&&part(partId).category===category,'配件类别不匹配');
    if(partId) requireThat(part(partId).release<=this.date,'配件尚未上市');
    if(category==='ram'||category==='storage') {
      requireThat(Number.isInteger(quantity)&&quantity>0&&quantity<=4,'数量需要是 1 至 4 的整数');
      draft[category]=[{id:partId!,quantity}];
      if(category==='storage') {draft.systemDrive=partId!;draft.workDrive=partId!;}
    } else (draft as any)[category]=partId;
    this.validateDesign(draft);
    if(category==='case') {draft.fanCount=part(partId!).game.defaultFans;draft.fanPositions=['fan0','fan1'];draft.fanDirections={fan0:'intake',fan1:'exhaust'};draft.caseModules.removeHddCage=false;}
    draft.slotAssignments={};draft.cableRoutes=[];invalidate(draft);Object.assign(d,draft);
  }
  addDrive(designId:string,partId:string) {
    this.active();
    const d=this.design(designId);requireThat(part(partId).category==='storage'&&part(partId).release<=this.date,'这个储存配件不可用');
    requireThat(d.storage.reduce((n,r)=>n+r.quantity,0)<4,'先减少其他储存设备再追加工作盘');
    d.storage.push({id:partId,quantity:1});d.slotAssignments={};d.cableRoutes=[];invalidate(d);
    d.workDrive=partId;
  }
  customize(id:string,values:Partial<Pick<ComputerDesign,'colors'|'lighting'|'fanProfile'|'fanCount'|'caseModules'|'finishLevelId'>>) {
    this.active();
    const d=this.design(id),draft={...clone(d),...clone(values)};
    const caseGame=part(draft.case).game;
    requireThat(['quiet','balanced','performance'].includes(draft.fanProfile),'运行模式不存在');
    requireThat(Number.isInteger(draft.fanCount)&&draft.fanCount>=2&&draft.fanCount<=caseGame.maxFans,'风扇数量超出机箱安装位');
    requireThat(!draft.caseModules.removeHddCage||caseGame.removableHddCage,'这个机箱的硬盘架不能拆除');
    finishing(draft);
    if(draft.caseModules.removeHddCage&&!d.caseModules.removeHddCage) {
      for(const i of instances(draft))if(i.part.category==='storage'&&i.part.game.bayType==='3.5-inch')uninstall(draft,i.key,false);
    }
    if(draft.fanCount!==d.fanCount) {
      const zones=geometry(draft).fanZones,positions=d.fanPositions.slice(0,draft.fanCount);
      for(const zone of zones)if(positions.length<draft.fanCount&&!positions.includes(zone.id))positions.push(zone.id);
      draft.fanPositions=positions;draft.fanDirections=Object.fromEntries(positions.map(position=>[position,d.fanDirections[position]||zones.find(z=>z.id===position)!.direction]));
      draft.cableRoutes=d.cableRoutes.filter(r=>!r.to.startsWith('case_fan_')||Number(r.to.slice('case_fan_'.length))<draft.fanCount);
    }
    invalidate(draft);Object.assign(d,draft);
  }
  setIdentity(id:string,name:string,price:number) {
    this.active();
    requireThat(name.trim()&&Number.isFinite(price)&&price>0&&price<=1000000,'请填写名称和合理的正整数售价');
    const d=this.design(id);
    const accepted=this.state.customers.find(c=>c.designId===id&&c.status==='accepted');
    if(accepted) {requireThat(Math.round(price)===accepted.agreedPrice,'已收预付款的委托售价已锁定');}
    d.name=name.trim().slice(0,28);d.price=Math.round(price);
    for(const unit of this.state.finished.filter(u=>u.designId===id&&u.status==='stock'&&u.design.revision===d.revision)) {
      unit.design.name=d.name;unit.design.price=d.price;
    }
  }
  setFanPosition(id:string,index:number,target:string) {
    this.active();const d=this.design(id),g=geometry(d);
    requireThat(Number.isInteger(index)&&index>=0&&index<d.fanPositions.length,'风扇不存在');
    requireThat(g.fanZones.some(f=>f.id===target),'这个机箱没有该风扇位置');
    requireThat(!d.fanPositions.some((p,i)=>p===target&&i!==index),'这个位置已经装有风扇');
    const before=d.fanPositions[index];if(before===target)return;
    const direction=d.fanDirections[before];delete d.fanDirections[before];d.fanPositions[index]=target;d.fanDirections[target]=direction;
    d.cableRoutes=d.cableRoutes.filter(r=>r.to!==`case_fan_${index}`);invalidate(d);
  }
  setFanDirection(id:string,index:number,direction:'intake'|'exhaust') {
    this.active();const d=this.design(id);
    requireThat(Number.isInteger(index)&&index>=0&&index<d.fanPositions.length,'风扇不存在');
    requireThat(direction==='intake'||direction==='exhaust','风扇方向需要选择进风或出风');
    const position=d.fanPositions[index];if(d.fanDirections[position]===direction)return;
    d.fanDirections[position]=direction;invalidate(d);
  }
  installPart(id:string,instance:string,slot:string) {this.active();install(this.design(id),instance,slot);}
  uninstallPart(id:string,instance:string) {this.active();return uninstall(this.design(id),instance);}
  connectWire(id:string,request:string,source:string,nodes:string[]) {this.active();connect(this.design(id),request,source,nodes);}
  assemble(id:string) {this.active();assistAssembly(this.design(id));}
  route(id:string) {this.active();assistRouting(this.design(id));}
  available(partId:string) {return this.state.inventory.filter(l=>l.partId===partId).reduce((n,l)=>n+l.quantity-l.reserved,0);}
  priceFactor(partId:string) {return categoryPriceFactor(this.state,part(partId).category);}
  unitPrice(partId:string,channelId='retail') {
    const p=part(partId),channel=DATA.channels.find(c=>c.id===channelId);requireThat(channel,'采购渠道不存在');
    return Math.ceil(p.game.basePriceCoins*channel!.nominalUnitPriceFactor*DATA.economy.opening[this.state.difficulty].supplierTermsFactor*this.priceFactor(partId));
  }
  quote(partId:string,quantity:number,channelId:string) {
    this.active();const p=part(partId),channel=DATA.channels.find(c=>c.id===channelId);
    requireThat(channel&&Number.isInteger(quantity)&&quantity>=channel!.minimumUnitsPerLine,'单笔同款数量未达到这个渠道的起订量');
    requireThat(p.release<=this.date,'配件尚未供货，公告不等于可采购');
    const launchMonth=p.release.slice(0,7);
    requireThat(channelId==='retail'||p.release==='2016-01-01'||this.date.slice(0,7)>launchMonth,'新品首月只提供少量零购现货');
    requireThat(quantity<=(this.state.supplierStock[`${p.id}:${channelId}`]||0),'当前渠道库存不足');
    const unitCost=this.unitPrice(partId,channelId);
    return {partId,quantity,channel:channel!,unitCost,total:unitCost*quantity,eta:this.absoluteHours+channel!.nominalDeliverySimHours};
  }
  purchase(partId:string,quantity:number,channelId='retail'):string {
    const quote=this.quote(partId,quantity,channelId);
    const credit=quote.channel.paymentTermMonths>0;
    requireThat(credit?this.outstandingCredit+quote.total<=this.creditLimit:this.state.cash>=quote.total,credit?'供应商授信额度不足':'资金不足，减少采购数量或选择替代配件');
    const id=this.id('purchase');
    this.post(id,'procurement',credit?0:-quote.total,0,`${part(partId).model} × ${quantity}`);
    this.state.supplierStock[`${partId}:${channelId}`]-=quantity;
    this.state.purchases.push({id,partId,quantity,unitCost:quote.unitCost,channel:channelId,eta:quote.eta,received:false,paid:!credit,dueMonth:credit?this.state.month+quote.channel.paymentTermMonths:null});
    this.taught('procurement');
    return id;
  }
  private reusable(d:ComputerDesign):FinishedUnit|undefined {return this.state.finished.find(u=>u.designId===d.id&&u.status==='stock');}
  missing(designId:string,quantity=1,rework=true):{id:string;quantity:number}[] {
    requireThat(Number.isInteger(quantity)&&quantity>0&&quantity<=80,'生产数量需要是正整数');
    const d=this.design(designId),old=rework&&quantity===1?this.reusable(d):undefined;
    return Object.entries(bill(d)).map(([id,count])=>{
      const retained=old?.components.filter(c=>c.partId===id).reduce((n,c)=>n+c.quantity,0)||0;
      const inTransit=this.state.purchases.filter(p=>p.partId===id&&!p.received).reduce((n,p)=>n+p.quantity,0);
      return {id,quantity:Math.max(0,count*quantity-retained-this.available(id)-inTransit)};
    }).filter(row=>row.quantity>0);
  }
  procureMissing(designId:string,quantity=1,preferredChannel='retail',rework=true) {
    const rows=this.missing(designId,quantity,rework);
    const channel=DATA.channels.find(c=>c.id===preferredChannel);requireThat(channel,'采购渠道不存在');
    const quotes=rows.map(row=>this.quote(row.id,row.quantity,row.quantity>=channel!.minimumUnitsPerLine?preferredChannel:'retail'));
    requireThat(this.state.cash>=quotes.filter(q=>!q.channel.paymentTermMonths).reduce((n,q)=>n+q.total,0),'资金不足以确认全部零购缺件');
    requireThat(this.outstandingCredit+quotes.filter(q=>q.channel.paymentTermMonths>0).reduce((n,q)=>n+q.total,0)<=this.creditLimit,'全部缺件超过供应商授信额度');
    for(const q of quotes) this.purchase(q.partId,q.quantity,q.channel.id);
    return quotes.length;
  }
  private reservations(d:ComputerDesign,quantity:number,reuse?:FinishedUnit) {
    const allocations:{lotId:string;quantity:number}[]=[],components:FinishedUnit['components']=[];
    for(const [id,count] of Object.entries(bill(d))) {
      let needed=count*quantity;
      for(const c of reuse?.components.filter(c=>c.partId===id)||[]) {
        const keep=Math.min(needed,c.quantity);if(keep) components.push({...c,quantity:keep});needed-=keep;
      }
      for(const lot of this.state.inventory.filter(l=>l.partId===id)) {
        const take=Math.min(needed,lot.quantity-lot.reserved);
        if(take>0) {allocations.push({lotId:lot.id,quantity:take});components.push({partId:id,quantity:take,unitCost:lot.unitCost});needed-=take;}
      }
      requireThat(needed===0,`${part(id).model} 尚未到货或库存已被其他工作预留`);
    }
    return {allocations,components};
  }
  customerIssues(d:ComputerDesign,customer:CustomerOrder):string[] {
    const t=evaluate(d,this.date),issues=[...t.blocked];
    // Thermal instability is a cost, not a veto: the balance model raises the failure rate for it.
    // The game has no failure model yet, so until that lands this only removes the rejection and the
    // penalty arrives with it.
    if(d.price>customer.budget) issues.push('售价超过客户创建订单时的预算');
    if(customer.maxNoise!==null&&t.noise>customer.maxNoise) issues.push(`客户要求噪声不高于 ${customer.maxNoise}`);
    if(t.ramGB<customer.minRam) issues.push(`客户要求至少 ${customer.minRam}GB 内存`);
    if(t.storageGB<customer.minStorage) issues.push(`客户要求至少 ${customer.minStorage}GB 储存`);
    if(customer.discreteGpu&&!d.gpu) issues.push('客户要求独立显卡');
    if(customer.minVram&&(!d.gpu||part(d.gpu).game.vramGB<customer.minVram)) issues.push(`客户要求至少 ${customer.minVram}GB 显存`);
    // A customer's colour preference affects how the machine is judged, not whether it sells: the
    // appearance score already rewards a body colour matching the brand, and a mismatch is a
    // preference rather than a rejection. The customer's colour is drawn at random, so vetoing on
    // it asked the player to guess a coin.
    for(const [use,value] of Object.entries(customer.minimumScores)) if(t.scores[use]<value) issues.push(`客户要求${({office:'办公',gaming:'游戏',creation:'创作'} as Record<string,string>)[use]||use}评分至少 ${value}`);
    return issues;
  }
  acceptCustomer(id:string,designId?:string) {
    this.active();const customer=this.state.customers.find(c=>c.id===id);
    requireThat(customer&&customer.status==='open'&&customer.dueMonth>=this.state.month,'订单已经关闭');
    const d=designId?this.design(designId):this.createDesign(customer!.kind);
    requireThat(!this.state.customers.some(c=>c.designId===d.id&&c.status==='accepted'),'这个设计已经绑定另一份委托');
    requireThat(!designId||d.price<=customer!.budget,'当前售价超过客户预算');
    customer!.status='accepted';customer!.designId=d.id;
    if(!designId) {d.colors.body=customer!.color;d.price=Math.min(d.price,customer!.budget);}
    customer!.agreedPrice=d.price;customer!.deposit=Math.round(d.price*DATA.customers.segments.bespoke.depositFraction);
    this.post(`${customer!.id}:deposit`,'deposit',customer!.deposit,0,'委托预付款');
    return d;
  }
  acceptUsingTemplate(id:string,templateId:string) {
    this.active();const customer=this.state.customers.find(c=>c.id===id);
    requireThat(customer&&customer.status==='open'&&customer.dueMonth>=this.state.month,'订单已经关闭');
    const d=this.copyDesign(templateId);
    d.kind=customer!.kind;d.name=`${d.name.replace(/ 改型$/,'')} · 高定`.slice(0,28);
    d.directCostCoins=DATA.balance.recipes.find(r=>r.id===d.kind)!.directCostCoins;
    d.price=Math.min(DATA.economy.products[d.kind].salePrice,customer!.budget);
    d.colors.body=customer!.color;invalidate(d);
    return this.acceptCustomer(id,d.id);
  }
  declineCustomer(id:string) {this.active();const c=this.state.customers.find(c=>c.id===id);requireThat(c&&c.status==='open','订单已经处理');c!.status='declined';}
  schedule(designId:string,quantity=1,kind:'prototype'|'production'|'commission'='prototype',customerId:string|null=null) {
    this.active();const d=this.design(designId);this.validateDesign(d);
    requireThat(Number.isInteger(quantity)&&quantity>0&&quantity<=80,'排产数量必须是 1 至 80 的整数');
    requireThat(kind==='production'||quantity===1,'打样和高定每次制作一台');
    const evaluation=evaluate(d,this.date);
    requireThat(!evaluation.blocked.length,evaluation.blocked[0]||'设计不能装配');
    requireThat(!this.state.jobs.some(j=>j.designId===d.id&&j.status!=='complete'),'这个设计已有未完成工作');
    if(kind!=='prototype') requireThat(d.prototypeMade&&d.test?.revision===d.revision&&d.test.coolingRatio>=1,'先制作样机并通过当前版本测试');
    if(kind==='production') requireThat(d.standardized,'先命名定价并保存为标准产品');
    const old=kind==='prototype'?this.reusable(d):undefined;
    const {allocations,components}=this.reservations(d,quantity,old);
    const recipe=DATA.economy.products[d.kind],commission=recipe.kind==='commission';
    const tools=this.state.investments.includes('craft_tools')?DATA.economy.investments.craft_tools:null;
    const automation=this.state.investments.includes('semi_auto')?DATA.economy.investments.semi_auto:null;
    const finish=finishWork(d,old?.design);
    const consumables=(old?0:Math.max(0,d.directCostCoins-(commission?tools?.commissionConsumablesReduction||0:automation?.standardConsumablesReduction||0))+
      Math.max(0,d.fanCount-part(d.case).game.defaultFans)*DATA.balance.additionalFanCostCoins)+finish.cost;
    // The economy records no per-employee failure multiplier, so the model uses one and so does this.
    // If grades ever carry one, this is where it would be read.
    const failRate=failureRate(d,evaluation,1);
    const development=kind==='prototype'&&!old&&!commission?(recipe.developmentCost||0):0;
    const reworkUnitCost=reworkCost(failRate,Number(recipe.expectedPartsCost)||0);
    requireThat(this.state.cash>=(consumables+reworkUnitCost)*quantity+development,'资金不足以支付本次制作耗材');
    if(customerId) {const c=this.state.customers.find(c=>c.id===customerId);requireThat(c&&c.status==='accepted'&&c.designId===d.id,'客户订单没有绑定这个设计');}
    const assembly=recipe.assemblyHours*(commission?tools?.commissionAssemblyMultiplier||1:automation?.standardAssemblyMultiplier||1);
    const stages:ScheduledJob['stages']=[];
    const designHours=old?0:commission?recipe.designHours:kind==='prototype'?recipe.developmentLaborHours||0:0;
    if(designHours) stages.push({name:'设计打样',hours:designHours,labor:1,owner:1,bench:0,test:0});
    if(kind==='prototype'&&!old&&!commission) {
      if(recipe.developmentBenchHours)stages.push({name:'研发工位准备',hours:recipe.developmentBenchHours,labor:0,owner:0,bench:1,test:0});
      if(recipe.developmentTestHours)stages.push({name:'研发验证',hours:recipe.developmentTestHours,labor:0,owner:0,bench:0,test:1});
    }
    stages.push({name:old?'修改装配':'手工装配',hours:assembly,labor:1,owner:0,bench:1,test:0});
    if(finish.labor)stages.push({name:'外观工艺',hours:finish.labor*(tools?.commissionAssemblyMultiplier||1),labor:1,owner:0,bench:0,test:0});
    stages.push({name:'测试准备',hours:recipe.testSetupHours,labor:1,owner:0,bench:0,test:0},{name:'压力测试',hours:recipe.testStationHours,labor:0,owner:0,bench:0,test:1},{name:'包装交付',hours:recipe.packingHours,labor:1,owner:0,bench:0,test:0});
    // The expected cost of things going wrong. Rework occupies labour and the test station, so an
    // unstable or power-starved design is slower as well as dearer; the consumables and any replaced
    // part are charged with the run.
    const rw=DATA.reliability.rework;
    if(failRate*rw.laborHours>0) stages.push({name:'返工预留',hours:failRate*rw.laborHours,labor:1,owner:0,bench:0,test:0});
    if(failRate*rw.testStationHours>0) stages.push({name:'返工测试预留',hours:failRate*rw.testStationHours,labor:0,owner:0,bench:0,test:1});
    const id=this.id('job');
    const job:ReworkJob={id,designId:d.id,design:clone(d),kind,customerId,quantity,completed:0,phase:0,remaining:stages[0].hours,
      materialReservations:allocations,unitPartsCost:components.reduce((n,c)=>n+c.quantity*c.unitCost,0)/quantity,consumables:consumables+reworkUnitCost,stages,status:'queued',components,reuseUnitId:old?.id};
    for(const row of allocations) this.state.inventory.find(l=>l.id===row.lotId)!.reserved+=row.quantity;
    if(old) {
      old.status='rework';
      const retainedPool=bill(d);
      for(const c of old.components) {
        const retained=Math.min(c.quantity,retainedPool[c.partId]||0);retainedPool[c.partId]=(retainedPool[c.partId]||0)-retained;
        const removed=c.quantity-retained;
        if(removed) this.state.inventory.push({id:this.id('recovered'),orderId:old.id,partId:c.partId,quantity:removed,reserved:0,unitCost:c.unitCost,channel:'recovered',receivedAt:this.absoluteHours});
      }
    }
    this.post(`${id}:consumables`,'consumables',-(consumables+reworkUnitCost)*quantity,0,d.name);
    if(development) this.post(`${id}:development`,'development',-development,development,d.name);
    this.state.jobs.push(job);return id;
  }
  private finish(job:ReworkJob) {
    const id=`${job.id}:finish:${job.completed}`;
    if(this.state.transactions.some(t=>t.id===id)) return;
    const needed=bill(job.design), components:FinishedUnit['components']=[];
    // Consume whole physical parts from FIFO lots, rather than fractionally dividing lots across units.
    for(const row of job.materialReservations) {
      const lot=this.state.inventory.find(l=>l.id===row.lotId)!;
      const amount=Math.min(row.quantity,needed[lot.partId]||0);
      if(!amount) continue;
      components.push({partId:lot.partId,quantity:amount,unitCost:lot.unitCost});needed[lot.partId]-=amount;row.quantity-=amount;
      lot.reserved-=amount;lot.quantity-=amount;
    }
    const test=evaluate(job.design,this.date);job.design.test=test;job.design.prototypeMade=true;
    if(job.kind==='prototype') {this.taught('prototyping');if(!test.blocked.length)this.taught('testing');}
    const current=this.design(job.designId);
    if(current.revision===job.design.revision) {current.test=clone(test);current.prototypeMade=true;}
    const prior=job.reuseUnitId?this.state.finished.find(u=>u.id===job.reuseUnitId):undefined;
    for(const c of prior?.components||[]) {const keep=Math.min(c.quantity,needed[c.partId]||0);if(keep) {components.push({...c,quantity:keep});needed[c.partId]-=keep;}}
    const priorNonParts=prior?Math.max(0,prior.cost-prior.components.reduce((n,c)=>n+c.quantity*c.unitCost,0)):0;
    const unit:FinishedUnit={id:this.id('unit'),designId:job.designId,kind:job.design.kind,design:clone(job.design),components,cost:components.reduce((n,c)=>n+c.quantity*c.unitCost,0)+job.consumables+priorNonParts,status:'stock',customerId:job.customerId};
    if(prior) this.state.finished=this.state.finished.filter(u=>u.id!==prior.id);
    this.state.finished.push(unit);this.post(id,'production',0,0,job.design.name);job.completed++;
    if(job.completed===job.quantity) job.status='complete';
    else {job.phase=0;job.remaining=job.stages[0].hours;job.status='queued';}
  }
  advance(hours:number,stopAtNews=true) {
    if(this.state.closed) return 0;
    requireThat(Number.isFinite(hours)&&hours>=0,'推进时间需要是非负数');
    if(stopAtNews&&this.state.pendingNews.length) return 0;
    const target=Math.min(this.monthHours,this.state.elapsed+hours),start=this.state.elapsed;
    while(this.state.elapsed<target-1e-8) {
      const dt=Math.min(.25,target-this.state.elapsed), capacity=this.capacity;
      const rates:ResourceUsage={labor:0,owner:0,bench:0,test:0};
      for(const order of this.state.purchases) if(!order.received&&order.eta<=this.absoluteHours+1e-8) {
        if(this.post(`${order.id}:receipt`,'receipt',0,0,part(order.partId).model)) this.state.inventory.push({id:`${order.id}:lot`,orderId:order.id,partId:order.partId,quantity:order.quantity,reserved:0,unitCost:order.unitCost,channel:order.channel,receivedAt:this.absoluteHours});
        order.received=true;
      }
      for(const job of this.state.jobs.filter(j=>j.status!=='complete')) {
        const stage=job.stages[job.phase];
        const step=Math.min(dt,job.remaining);
        const limits:ResourceUsage={labor:Math.max(1,1+this.state.employees),owner:1,bench:this.state.benches,test:this.state.testStations};
        if((Object.keys(rates) as (keyof ResourceUsage)[]).some(k=>rates[k]+stage[k]>limits[k]||this.state.used[k]+stage[k]*step>capacity[k]+1e-8)) continue;
        job.status='running';
        for(const key of Object.keys(rates) as (keyof ResourceUsage)[]) {rates[key]+=stage[key];this.state.used[key]+=stage[key]*step;}
        job.remaining-=step;
        if(job.remaining<=1e-8) {job.phase++;if(job.phase===job.stages.length) this.finish(job);else job.remaining=job.stages[job.phase].hours;}
      }
      this.state.elapsed+=dt;
      for(const event of DATA.events) if(event.date<=this.date&&!this.state.seenEvents.includes(event.id)) {this.state.seenEvents.push(event.id);this.state.pendingNews.push(event.title);}
      if(stopAtNews&&this.state.pendingNews.length) break;
    }
    // Process an arrival exactly on a chosen jump boundary without advancing another interval.
    for(const order of this.state.purchases) if(!order.received&&order.eta<=this.absoluteHours+1e-8) {
      if(this.post(`${order.id}:receipt`,'receipt',0,0,part(order.partId).model)) this.state.inventory.push({id:`${order.id}:lot`,orderId:order.id,partId:order.partId,quantity:order.quantity,reserved:0,unitCost:order.unitCost,channel:order.channel,receivedAt:this.absoluteHours});
      order.received=true;
    }
    return this.state.elapsed-start;
  }
  nextWork() {
    if(this.state.pendingNews.length) {this.acknowledgeNews();return 0;}
    const arrivals=this.state.purchases.filter(p=>!p.received).map(p=>p.eta-this.absoluteHours);
    const remaining=this.state.jobs.filter(j=>j.status!=='complete').map(j=>j.remaining);
    const next=Math.min(...arrivals,...remaining,8);
    return this.advance(Math.max(.25,next));
  }
  resume(now:number) {
    const elapsed=Math.max(0,now-this.state.lastWallTime)/30000;
    const hasWork=this.state.jobs.some(j=>j.status!=='complete')||this.state.purchases.some(p=>!p.received);
    const advanced=hasWork?this.advance(elapsed,false):0;
    this.state.lastWallTime=now;return advanced;
  }
  standardize(id:string) {
    this.active();const d=this.design(id);requireThat(d.prototypeMade&&d.test?.revision===d.revision&&!d.test.blocked.length&&d.test.coolingRatio>=1,'当前版本需要先制作样机并通过测试');
    d.standardized=true;
  }
  demandAssessment(designId:string):DemandAssessment {
    const d=this.design(designId),cap=DATA.economy.companyDemandCaps[d.kind][this.state.month-1];
    const archetypes=DATA.customers.archetypes.filter(a=>a.referenceRecipe===d.kind),weights=archetypes.reduce((n,a)=>n+a.weight,0);
    const test=d.test?.revision===d.revision?d.test:evaluate(d,this.date,false),curve=DATA.customers.priceAcceptance;
    const preference=DATA.customers.appearancePreference,span=preference?100-preference.baselineScore:0;
    const appearancePremium=preference&&span>0?Math.max(0,test.appearance-preference.baselineScore)/span*preference.maxPricePremium:0;
    // Reputation is a mark out of five: the player starts at one having sold nothing, and a mark below
    // neutral is the absence of a record rather than a bad one, so it does not penalise. Above neutral
    // each point lifts the month's expected custom by the policy's step.
    const repPolicy=DATA.customers.reputation,rep=this.state.reputation,neutral=Number(repPolicy.neutral??3);
    const growthScale=rep>neutral?1+(rep-neutral)*Number(repPolicy.effectPerPoint??0.15):1;
    const rows=archetypes.map(a=>{
      const r=a.requirements,issues:string[]=[];
      const budgetCeiling=a.budgetCoins[1]*(1+appearancePremium);
      if(d.price>budgetCeiling)issues.push(`售价超过预算上限 ¥${Math.round(budgetCeiling)}`);
      if(test.ramGB<(r.minimumRamGB||0))issues.push(`内存不足 ${r.minimumRamGB}GB`);
      if(test.storageGB<(r.minimumStorageGB||0))issues.push(`储存不足 ${r.minimumStorageGB}GB`);
      if(r.requiredDiscreteGpu&&!d.gpu)issues.push('需要独立显卡');
      if(r.minimumVramGB&&(!d.gpu||part(d.gpu).game.vramGB<r.minimumVramGB))issues.push(`显存不足 ${r.minimumVramGB}GB`);
      if(r.maximumNoiseBurden!==null&&test.noise>r.maximumNoiseBurden)issues.push(`噪声超过 ${r.maximumNoiseBurden}`);
      for(const [k,v] of Object.entries(r.minimumScores))if(test.scores[k]<v)issues.push(`${{office:'办公',gaming:'游戏',creation:'创作'}[k]||k}评分未达到 ${v}`);
      const referencePrice=(a.budgetCoins[0]+a.budgetCoins[1])/2*(1+appearancePremium),ratio=d.price/referencePrice;
      const acceptance=ratio<=1?Math.min(curve.ceiling,1+curve.belowSlope*(1-ratio)):Math.max(curve.floor,1-curve.aboveSlopeBySegment[a.segment]*(ratio-1));
      const fit=Math.min(1,test.scores[a.fitUseCase]/a.expectedScore);
      return {archetype:a.id,name:a.zh,eligible:!issues.length,issues,referencePrice,acceptance,fit,expectedUnits:issues.length?0:cap*a.weight/weights*fit*acceptance*growthScale};
    });
    const estimated=Math.max(0,Math.floor(rows.reduce((n,r)=>n+r.expectedUnits,0))),alreadySold=this.state.soldThisMonth[d.kind]||0;
    const reasons:string[]=[];
    if(!rows.some(r=>r.eligible))reasons.push('当前配置或售价未满足目标客群要求');
    else if(alreadySold>=estimated)reasons.push('当前产品表现与售价对应的本月需求已满足');
    if(rows.some(r=>r.eligible&&r.acceptance<1))reasons.push('高于参考价的定价降低了成交意愿');
    if(rows.some(r=>r.eligible&&r.fit<1))reasons.push('用途表现仍低于部分客户期望，可尝试调整配置');
    if(this.state.reputation<1)reasons.push('客户口碑降低了本月成交预期');
    return {available:Math.max(0,estimated-alreadySold),estimated,alreadySold,rows,reasons};
  }
  /**
   * A fault that reached the customer: the sale is refunded, the machine shipped back and
   * reputation takes the hit the customer model defines.
   *
   * The balance model charges this as an expected value per machine built. Here it is rolled, so a
   * player can actually meet a faulty machine; the rates are the same, so the long-run totals match
   * and a single run varies.
   */
  /**
   * A customer leaves one review per delivered machine, and the shop's mark is their weighted
   * average. Meeting the commitment guarantees at least a three, exceeding it makes a five much more
   * likely, and missing or mishandling it lands in the low marks, so the mark drifts with each order
   * rather than stepping by a fixed amount.
   */
  private recordReview(outcome:'met'|'exceeded'|'late'|'missed',exceeded=false) {
    const rep=DATA.customers.reputation,dist=(rep.reviews as Record<string,Record<string,number>>)[outcome];
    let roll=this.random(),mark=Number(Object.keys(dist)[0]);
    for(const [value,share] of Object.entries(dist) as [string,number][]) { mark=Number(value); if((roll-=share)<=0) break; }
    this.state.ratingSum+=mark;this.state.ratingCount+=1;
    const prior=Number(rep.priorWeight)||0;
    this.state.reputation=Math.min(rep.ceiling,Math.max(rep.floor,(prior*rep.initial+this.state.ratingSum)/(prior+this.state.ratingCount)));
  }
  private escapedDefect(unitId:string,design:ComputerDesign,price:number,label:string):boolean {
    const report=design.test;if(!report)return false;
    const hours=Number(DATA.economy.products[design.kind].testStationHours)||0;
    const chance=failureRate(design,report,1)*escapeRate(hours);
    if(this.random()>=chance)return false;
    const ad=DATA.reliability.arrivalDefect;
    this.post(`${unitId}:refund`,'salesRefund',-price*ad.refundFraction,0,`${label}：到货故障退款`);
    this.post(`${unitId}:logistics`,'logistics',-ad.logisticsCoins,ad.logisticsCoins,`${label}：到货故障物流`);
    this.recordReview('missed');
    return true;
  }
  sellStock(designId:string,maximum=80) {
    this.active();const d=this.design(designId);requireThat(d.standardized,'先将作品保存为标准产品');
    const kind=d.kind,assessment=this.demandAssessment(d.id),demand=assessment.available;
    let sold=0,dispatched=0,refunded=0;
    for(const unit of this.state.finished.filter(u=>u.designId===designId&&u.design.revision===d.revision&&u.status==='stock'&&!u.customerId)) {
      if(dispatched>=Math.min(maximum,demand)) break;
      requireThat(unit.design.test&&!unit.design.test.blocked.length&&unit.design.test.coolingRatio>=1,'库存中的旧版本未通过测试');
      this.post(`${unit.id}:sale`,'sale',d.price,unit.cost,d.name);
      const fault=this.escapedDefect(unit.id,unit.design,d.price,d.name);
      unit.deliveryOutcome=fault?'arrival_defect':'delivered';
      const pref=DATA.customers.appearancePreference;
      if(!fault) {this.recordReview(pref&&unit.design.test&&unit.design.test.appearance>pref.baselineScore?'exceeded':'met');sold++;}
      else refunded++;
      unit.status='sold';dispatched++;
    }
    this.state.soldThisMonth[kind]=(this.state.soldThisMonth[kind]||0)+dispatched;
    return {sold,refunded,remainingDemand:Math.max(0,demand-dispatched),reason:!demand?assessment.reasons.join('；'):refunded?`${refunded} 台到货故障，已退款并记录物流支出，未计入成功销量。`:'已按本月需求销售，未售出的成品留在库存'};
  }
  deliver(customerId:string) {
    this.active();const c=this.state.customers.find(c=>c.id===customerId);
    requireThat(c&&c.status==='accepted'&&c.designId,'客户订单尚未接受或已经交付');
    requireThat(c!.dueMonth>=this.state.month,'订单已经逾期');
    const d=this.design(c!.designId!),issues=this.customerIssues(d,c!);
    requireThat(!issues.length,issues[0]||'客户需求未满足');
    const unit=this.state.finished.find(u=>u.designId===d.id&&u.design.revision===d.revision&&u.status==='stock'&&(!u.customerId||u.customerId===customerId));
    requireThat(unit&&unit.design.test?.revision===d.revision,'当前设计版本尚未完成制作和测试');
    requireThat(d.test?.revision===d.revision,'设计修改后需要重新测试');
    this.post(`${unit!.id}:sale`,'sale',d.price-c!.deposit,unit!.cost,`${c!.name}：${d.name}`);
    this.post(`${c!.id}:earnedDeposit`,'earnedDeposit',0,0,String(c!.deposit));
    const fault=this.escapedDefect(unit!.id,unit!.design,d.price,`${c!.name}：${d.name}`);
    unit!.deliveryOutcome=c!.deliveryOutcome=fault?'arrival_defect':'delivered';
    unit!.status='sold';unit!.customerId=c!.id;c!.status='completed';c!.satisfaction=fault?null:Math.round(Math.min(100,80+(d.test!.appearance-65)*.2+(d.test!.tidiness-65)*.2));
    // The customer rates the job. A machine that looks better than the reference they had in mind
    // reads as exceeding expectations, which is what makes a five much more likely.
    const pref=DATA.customers.appearancePreference;
    if(!fault)this.recordReview(pref&&d.test!.appearance>pref.baselineScore?'exceeded':'met');
    this.state.soldThisMonth[d.kind]=(this.state.soldThisMonth[d.kind]||0)+1;
    return c!.satisfaction;
  }
  invest(id:string) {
    this.active();const investment=DATA.economy.investments[id];requireThat(investment,'投资项目不存在');
    requireThat(id==='bench'||!this.state.investments.includes(id),'这个项目已经完成投资');
    requireThat(!investment.requiresBenches||this.state.benches>=investment.requiresBenches,'先增加工作台，才能安排半自动设备');
    requireThat(this.state.cash>=investment.cost,'资金不足');
    this.post(this.id('investment'),'investment',-investment.cost,0,id);this.state.investments.push(id);this.state.benches+=investment.addedBenches||0;
  }
  hire() {
    this.active();requireThat(this.state.cash>=DATA.economy.employee.recruitmentCost,'资金不足以支付招聘费用');
    this.post(this.id('hire'),'investment',-DATA.economy.employee.recruitmentCost,0,'招聘装配员工');this.state.employees++;
  }
  settle():MonthReport {
    this.active();
    for(const purchase of this.state.purchases.filter(p=>!p.paid&&p.dueMonth!==null&&p.dueMonth<=this.state.month)) {
      this.post(`${purchase.id}:payment`,'payable',-purchase.quantity*purchase.unitCost,0,'偿付供应商账款');purchase.paid=true;
    }
    this.post(`month:${this.state.month}:fixed`,'fixed',-this.fixedCost,this.fixedCost,'租金、水电与员工工资');
    const feedback:string[]=[];
    for(const c of this.state.customers) if(c.dueMonth<=this.state.month&&['open','accepted'].includes(c.status)) {
      if(c.status==='accepted') {this.post(`${c.id}:refund`,'depositRefund',-c.deposit,0,'逾期委托退回预付款');this.recordReview('late');feedback.push(`${c.name}：未按月交付，退回预付款并影响口碑。`);}c.status='expired';
    }
    const entries=this.state.transactions.filter(t=>t.month===this.state.month),sales=entries.filter(t=>t.kind==='sale');
    const amounts=monthAmounts(entries),{revenue,cogs,salesRefunds,logisticsCosts,depositRefunds}=amounts;
    const fixed=entries.filter(t=>t.kind==='fixed').reduce((n,t)=>n+t.cost,0),development=entries.filter(t=>t.kind==='development').reduce((n,t)=>n+t.cost,0);
    const soldUnits=this.state.finished.filter(u=>successfulUnit(u)&&sales.some(t=>t.id===`${u.id}:sale`)),stock=this.state.finished.filter(u=>u.status==='stock');
    if(salesRefunds)feedback.push(`到货故障销售退款 ¥${Math.round(salesRefunds)}，物流 ¥${Math.round(logisticsCosts)}；故障电脑不计入成功销量，制作成本仍计入本月支出。`);
    if(stock.length)feedback.push(`${stock.length} 台成品留在库存，占用 ¥${Math.round(stock.reduce((n,u)=>n+u.cost,0))}；月结不会替你卖掉库存。`);
    for(const id of Array.from(new Set(soldUnits.map(u=>u.designId)))) {
      const d=this.design(id),a=this.demandAssessment(id);
      feedback.push(`${d.name}：本月售出 ${soldUnits.filter(u=>u.designId===id).length} 台${a.reasons.length?'，'+a.reasons.join('；'):''}。`);
    }
    const report:MonthReport={month:this.state.month,revenue,cogs,fixed,development,profit:revenue-cogs-fixed-development-logisticsCosts,cash:this.state.cash,sold:soldUnits.length,unsold:stock.length,reputation:this.state.reputation,used:clone(this.state.used),feedback,stockCost:stock.reduce((n,u)=>n+u.cost,0),payables:this.outstandingCredit,standardSold:soldUnits.filter(u=>!u.customerId).length,commissionSold:soldUnits.filter(u=>!!u.customerId).length,salesRefunds,logisticsCosts,depositRefunds,legacyAccounting:amounts.legacyAccounting};
    report.cash=this.state.cash;report.reputation=this.state.reputation;this.state.reports.push(report);this.taught('monthly_settlement');
    if(this.state.cash<0) {this.state.bankrupt=true;this.state.closed=true;}
    if(this.state.month===6) this.state.closed=true;
    if(!this.state.closed) {this.state.month++;this.state.elapsed=0;this.refreshMonth();this.state.pendingNews.push(`${this.state.month} 月开始。库存和未完成排产已保留。`);}
    return report;
  }
}
