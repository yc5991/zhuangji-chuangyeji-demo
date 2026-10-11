import type {View} from './types';

/** Saves use the assembly-side coordinates. Rear artwork is viewed from the opposite side. */
export function viewPoint(point:number[],caseWidth:number,view:View):number[] {
  return [view==='rear'?caseWidth-point[0]:point[0],point[1]];
}
export function viewRect(rect:number[],caseWidth:number,view:View):number[] {
  return [view==='rear'?caseWidth-rect[0]-rect[2]:rect[0],rect[1],rect[2],rect[3]];
}
