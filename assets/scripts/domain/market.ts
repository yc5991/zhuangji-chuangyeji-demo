import type {Category,GameState,MarketEventSpec,MarketRecord,RandomAdapter} from './types';

export const SEEDED_RANDOM:RandomAdapter={
  next(seed:number) {
    const next=(Math.imul(seed,1664525)+1013904223)>>>0;
    return {seed:next,value:next/4294967296};
  }
};

/** Resolve each saved event once. Existing orders and stock lots keep their quoted cost. */
export function updateMarket(state:GameState,events:MarketEventSpec[],draw:()=>number) {
  const announce=(key:string,message:string)=>{
    if(state.seenEvents.includes(key))return;
    state.seenEvents.push(key);state.pendingNews.push(message);
  };
  for(const event of events) {
    if(state.month<event.omenMonth)continue;
    let record=state.marketRecords.find(r=>r.id===event.id);
    if(!record) {
      record={id:event.id,title:event.zh,omenMonth:event.omenMonth,resolveMonth:event.resolveMonth,throughMonth:event.throughMonth,
        categories:[...event.affectedCategories],outcomeId:null,outcomeName:null,multiplier:1,roll:null,feedback:'',expired:state.month>event.throughMonth};
      state.marketRecords.push(record);
    }
    if(state.month>record.throughMonth) {
      record.expired=true;
      if(record.outcomeId)announce(`market:${record.id}:end`,`${record.title}：本轮报价影响结束，新采购恢复基础报价。旧批次成本保持原记录。`);
      continue;
    }
    if(state.month<record.resolveMonth) {
      announce(`market:${record.id}:omen`,`${record.title} · 预兆\n${event.omen}\n${event.whyItIsUncertain}`);
      continue;
    }
    if(record.outcomeId!==null)continue;
    const total=event.outcomes.reduce((n,o)=>n+o.weight,0),roll=draw();
    let cursor=roll*total,outcome=event.outcomes[event.outcomes.length-1];
    for(const option of event.outcomes) {cursor-=option.weight;if(cursor<0) {outcome=option;break;}}
    record.roll=roll;record.outcomeId=outcome.id;record.outcomeName=outcome.zh;
    record.multiplier=outcome.categoryMultiplier;record.feedback=outcome.feedback;
    announce(`market:${record.id}:result`,`${record.title} · ${outcome.zh}\n${outcome.feedback}\n新采购报价变化 ${Math.round((record.multiplier-1)*100)}%，影响持续至 ${record.throughMonth} 月。已确认采购和库存成本保持不变。`);
  }
}

export function categoryPriceFactor(state:GameState,category:Category):number {
  return state.marketRecords.filter(r=>r.outcomeId!==null&&!r.expired&&state.month>=r.resolveMonth&&state.month<=r.throughMonth&&r.categories.includes(category))
    .reduce((factor,r)=>factor*r.multiplier,1);
}

export function marketHistory(records:MarketRecord[]):string[] {
  return records.map(r=>r.outcomeId
    ?`${r.title}：${r.outcomeName}，新报价 ${Math.round((r.multiplier-1)*100)}%（${r.resolveMonth}—${r.throughMonth} 月）${r.expired?'，影响已结束':''}`
    :r.expired?`${r.title}：此旧存档没有保存历史结果`:`${r.title}：等待 ${r.resolveMonth} 月结果，备货会占用资金`);
}
