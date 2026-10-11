import type {Transaction,FinishedUnit,CustomerOrder} from './types';

// Recognize the previous version's shared refund kind without rewriting its cash ledger.
export function salesRefund(t:Transaction):boolean {
  return t.kind==='salesRefund'||(t.kind==='refund'&&t.note.endsWith('到货故障退款'));
}
export function logistics(t:Transaction):boolean {
  return t.kind==='logistics'||(t.kind==='refund'&&t.id.endsWith(':logistics'));
}
export function monthAmounts(entries:Transaction[]) {
  const sum=(rows:Transaction[],field:'cash'|'cost')=>rows.reduce((n,t)=>n+t[field],0);
  const sales=entries.filter(t=>t.kind==='sale');
  const grossRevenue=sum(sales,'cash')+entries.filter(t=>t.kind==='earnedDeposit').reduce((n,t)=>n+Number(t.note),0);
  const refunds=entries.filter(salesRefund),salesRefunds=-sum(refunds,'cash')||0;
  const logisticsCosts=-sum(entries.filter(logistics),'cash')||0;
  const depositRefunds=-sum(entries.filter(t=>t.kind==='depositRefund'||(t.kind==='refund'&&!salesRefund(t)&&!logistics(t))),'cash')||0;
  return {revenue:grossRevenue-salesRefunds,cogs:sum(sales,'cost'),salesRefunds,logisticsCosts,depositRefunds,
    legacyAccounting:refunds.some(t=>!sales.some(s=>s.id===t.id.replace(/:refund$/,':sale')))};
}
export function successfulUnit(unit:FinishedUnit):boolean {
  return unit.status==='sold'&&unit.deliveryOutcome!=='arrival_defect';
}
export function successfulCustomer(customer:CustomerOrder):boolean {
  return customer.status==='completed'&&customer.deliveryOutcome!=='arrival_defect';
}
