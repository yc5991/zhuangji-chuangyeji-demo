import {DATA} from './data';
import type {BusinessSummary,GameState} from './types';
import {successfulUnit,successfulCustomer} from './accounting';

/** The ending uses saved work and actual sales, without treating low volume as failure. */
export function businessSummary(state:GameState):BusinessSummary {
  const sold=state.finished.filter(successfulUnit),commissions=state.customers.filter(successfulCustomer);
  const standardSales=sold.filter(u=>!u.customerId).length,commissionSales=sold.length-standardSales;
  const boutique=commissionSales>0||state.investments.includes('craft_tools');
  const scale=standardSales>0||state.investments.includes('semi_auto')||state.benches>DATA.economy.opening[state.difficulty].benches;
  const works=new Map<string,BusinessSummary['works'][number]>();
  for(const unit of state.finished.filter(u=>u.status!=='rework')) {
    const previous=works.get(unit.designId);
    if(!previous)works.set(unit.designId,{id:unit.designId,name:unit.design.name,kind:unit.kind,sold:successfulUnit(unit)?1:0,revision:unit.design.revision,test:unit.design.test});
    else {
      previous.sold+=successfulUnit(unit)?1:0;
      if(unit.design.revision>=previous.revision) {previous.name=unit.design.name;previous.revision=unit.design.revision;previous.test=unit.design.test;}
    }
  }
  const opening=DATA.economy.opening[state.difficulty],hours=DATA.economy.stationMonthlyHours;
  const stock=state.finished.filter(u=>u.status==='stock');
  return {months:state.reports.length,sales:sold.length,standardSales,commissionSales,
    revenue:state.reports.reduce((n,r)=>n+r.revenue,0),profit:state.reports.reduce((n,r)=>n+r.profit,0),cash:state.cash,
    payables:state.purchases.filter(p=>!p.paid).reduce((n,p)=>n+p.unitCost*p.quantity,0),stockUnits:stock.length,stockCost:stock.reduce((n,u)=>n+u.cost,0),
    inventoryCost:state.inventory.reduce((n,l)=>n+l.quantity*l.unitCost,0),completedCommissions:commissions.length,reputation:state.reputation,
    averageSatisfaction:commissions.length?commissions.reduce((n,c)=>n+(c.satisfaction||0),0)/commissions.length:null,
    capacity:{labor:opening.ownerHours+state.employees*DATA.economy.employee.monthlyLaborHours,owner:opening.ownerHours,bench:state.benches*hours,test:state.testStations*hours},
    benches:state.benches,employees:state.employees,direction:boutique&&scale?'mixed':boutique?'boutique':scale?'scale':'workshop',
    works:Array.from(works.values()).sort((a,b)=>b.sold-a.sold||b.revision-a.revision),market:JSON.parse(JSON.stringify(state.marketRecords))};
}
