import {DATA} from './data';
import type {ComputerDesign} from './types';

export function finishing(design:ComputerDesign) {
  const level=DATA.finish.levels.find(l=>l.id===(design.finishLevelId||'standard'));
  if(!level)throw new Error('外观工艺不存在');
  const chosen:Record<string,string>={front_panel:design.caseModules.panel,side_panel:design.caseModules.sidePanel==='sealed'?'steel':design.caseModules.sidePanel,
    colour:['graphite','black'].includes(design.colors.body)?'black':['silver','white'].includes(design.colors.body)?'white':'custom',lighting:design.lighting==='off'?'none':design.lighting==='argb'?'argb':'single'};
  const options=Object.entries(chosen).map(([groupId,id])=>{
    const group=DATA.caseOptions.groups.find(g=>g.id===groupId),option=group?.options.find(o=>o.id===id);
    if(!option)throw new Error('机箱外观选项不存在');
    return {group:groupId,...option};
  });
  return {level,options,cost:level.additionalConsumablesCoins+options.reduce((n,o)=>n+o.cost,0),labor:level.additionalLaborHours,
    appearance:Math.min(100,DATA.finish.baseAppearancePoints+level.appearancePoints+options.reduce((n,o)=>n+o.appearancePoints,0)),
    cooling:options.reduce((n,o)=>n*o.coolingMultiplier,1),noise:options.reduce((n,o)=>n*o.noiseMultiplier,1)};
}

/** A reworked computer retains previous costs; only replacement options and a changed finish need new materials. */
export function finishWork(design:ComputerDesign,previous?:ComputerDesign) {
  const current=finishing(design);if(!previous)return {cost:current.cost,labor:current.labor};
  const before=finishing(previous),newFinish=current.level.id!==before.level.id;
  return {cost:(newFinish?current.level.additionalConsumablesCoins:0)+current.options.filter(o=>before.options.find(p=>p.group===o.group)?.id!==o.id).reduce((n,o)=>n+o.cost,0),labor:newFinish?current.labor:0};
}
