import type {StorageAdapter,ClockAdapter,GameState,SaveSnapshot} from './types';
import {Game} from './game';

const KEY='orangegame.save.v1',BACKUP='orangegame.save.backup.v1';
function checksum(text:string) {let hash=2166136261;for(let i=0;i<text.length;i++) hash=Math.imul(hash^text.charCodeAt(i),16777619);return (hash>>>0).toString(16);}
export class FutureSaveError extends Error {}
export class SaveStore {
  constructor(private storage:StorageAdapter,private clock:ClockAdapter={now:()=>Date.now()}) {}
  private decode(raw:string|null):GameState|null {
    if(!raw) return null;
    const snapshot=JSON.parse(raw) as SaveSnapshot;
    if(snapshot.version>2) throw new FutureSaveError('这个存档来自更新版本，已保留原记录，请使用更新的游戏读取');
    if(![1,2].includes(snapshot.version)||checksum(snapshot.payload)!==snapshot.checksum) throw new Error('存档校验失败');
    const state=JSON.parse(snapshot.payload) as GameState;
    if(state.schemaVersion>2)throw new FutureSaveError('这个存档使用更新的状态格式，已保留原记录，请使用更新的游戏读取');
    return new Game(state).state;
  }
  load():{game:Game|null;recovered:boolean;message:string} {
    let damaged=false;
    try {const state=this.decode(this.storage.getItem(KEY));if(state) {const game=new Game(state);const advanced=game.resume(this.clock.now());return {game,recovered:false,message:advanced?`离线工作推进了 ${advanced.toFixed(1)} 工时，月份保持不变`:''};}}
    catch(error) {if(error instanceof FutureSaveError) throw error;damaged=true;}
    try {const state=this.decode(this.storage.getItem(BACKUP));if(state) {const game=new Game(state);game.resume(this.clock.now());return {game,recovered:true,message:'当前记录损坏，已恢复上一份备份'};}}
    catch(error) {if(error instanceof FutureSaveError) throw error;damaged=true;}
    return {game:null,recovered:false,message:damaged?'本地记录无法读取，原记录已保留，请创建新公司或恢复外部备份':''};
  }
  save(game:Game) {
    // Do not replace the only healthy backup with a corrupt or future primary record.
    const current=this.storage.getItem(KEY);
    if(current) {try {if(this.decode(current)) this.storage.setItem(BACKUP,current);} catch(error) {if(error instanceof FutureSaveError) throw error;}}
    game.state.lastWallTime=this.clock.now();
    const payload=JSON.stringify(game.state),snapshot:SaveSnapshot={version:2,payload,checksum:checksum(payload),savedAt:game.state.lastWallTime};
    this.storage.setItem(KEY,JSON.stringify(snapshot));
  }
}
