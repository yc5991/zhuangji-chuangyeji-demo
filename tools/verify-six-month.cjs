// Validate persisted evidence against the original ledger, then bind it to build digests.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,v)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),JSON.stringify(v,null,2)+'\n');};
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
function digest(dir){
  const files=[];
  function walk(p){for(const e of fs.readdirSync(path.join(root,p),{withFileTypes:true})){const f=p+'/'+e.name;if(e.isDirectory())walk(f);else if(!/project\.(private\.)?config\.json$/.test(f))files.push(f);}}
  walk(dir);files.sort();const h=crypto.createHash('sha256');let bytes=0;
  for(const file of files){h.update(file.slice(dir.length+1));h.update('\0');h.update(hash(file));h.update('\n');bytes+=fs.statSync(path.join(root,file)).size;}
  return{sha256:h.digest('hex'),files:files.length,bytes,excludes:'project.config.json and project.private.config.json (local account configuration)'};
}
const close=(a,b,what)=>assert(Math.abs(a-b)<1e-7,`${what}: ${a} != ${b}`);
const sum=(rows,key)=>rows.reduce((n,t)=>n+t[key],0);
const rounds=n=>Number(n.toFixed(2));
function checkState(s){
  assert.equal(s.schemaVersion,2);assert.equal(s.difficulty,'normal');assert.equal(s.reports.length,6);assert(s.closed&&!s.bankrupt);
  assert.equal(new Set(s.transactions.map(t=>t.id)).size,s.transactions.length,'unique ledger records');
  const opening=require('../.local/tests/data').DATA.economy.opening.normal.cash;
  for(const r of s.reports){
    const tx=s.transactions.filter(t=>t.month===r.month),sales=tx.filter(t=>t.kind==='sale');
    for(const kind of ['procurement','production','sale'])assert(tx.some(t=>t.kind===kind),`month ${r.month} missing ${kind}`);
    const refunds=-sum(tx.filter(t=>t.kind==='salesRefund'),'cash');
    const logistics=-sum(tx.filter(t=>t.kind==='logistics'),'cash');
    const deposits=-sum(tx.filter(t=>t.kind==='depositRefund'),'cash');
    const revenue=sum(sales,'cash')+tx.filter(t=>t.kind==='earnedDeposit').reduce((n,t)=>n+Number(t.note),0)-refunds;
    const cogs=sum(sales,'cost'),fixed=-sum(tx.filter(t=>t.kind==='fixed'),'cash'),development=-sum(tx.filter(t=>t.kind==='development'),'cash');
    const success=sales.filter(t=>s.finished.find(u=>t.id===u.id+':sale')?.deliveryOutcome==='delivered');
    close(r.cash,opening+sum(s.transactions.filter(t=>t.month<=r.month),'cash'),'cash');
    for(const [key,value] of Object.entries({revenue,cogs,fixed,development,salesRefunds:refunds,logisticsCosts:logistics,depositRefunds:deposits,profit:revenue-cogs-fixed-development-logistics,sold:success.length}))close(r[key],value,`month ${r.month} ${key}`);
    assert.equal(r.sold,r.standardSold+r.commissionSold);
  }
  for(const p of s.purchases)for(const lot of s.inventory.filter(l=>l.id===p.id+':lot'))close(lot.unitCost,p.unitCost,'locked inventory cost');
  for(const u of s.finished.filter(u=>u.deliveryOutcome==='arrival_defect')){
    assert.equal(s.transactions.filter(t=>t.id===u.id+':sale').length,1);
    assert.equal(s.transactions.filter(t=>t.id===u.id+':refund').length,1);
    assert.equal(s.transactions.filter(t=>t.id===u.id+':logistics').length,1);
    assert(s.transactions.find(t=>t.id===u.id+':sale').cost>0,'fault retains consumed cost');
  }
}
const {runRoute}=require('../tests/helpers/six-month.cjs');
const rules=[];
for(const route of ['boutique','scale','mixed']){
  const r=runRoute(route);checkState(r.state);
  write(`.local/playtests/rules/${route}/run.json`,r);
  r.snapshots.forEach((s,i)=>write(`.local/playtests/rules/${route}/month-${i+1}.json`,s));
  rules.push({route,seed:20261011,months:6,sales:r.summary.sales,cash:rounds(r.state.cash),profit:rounds(sum(r.evidence,'profit')),saveVersion:r.save.version,evidence:`.local/playtests/rules/${route}/run.json`});
}
const browser=[];
for(const route of ['boutique','scale','mixed']){
  const base=`.local/playtests/v3/${route}`,run=read(base+'/run.json');checkState(run.state);
  const restored=read(base+'/reload-ending.json').state;
  for(const key of ['designs','reports','transactions','finished','marketRecords'])assert.deepEqual(restored[key],run.state[key],`restored ${route} ${key}`);
  const checkpoints=[];
  for(let i=1;i<=6;i++){
    const p=base+`/month-${i}.json`,snapshot=read(p),report=snapshot.state.reports.at(-1);
    assert.equal(report.month,i);assert.deepEqual(report,run.state.reports[i-1]);
    assert(Object.keys(snapshot.storage).length>0,'full local save retained');
    checkpoints.push({month:i,path:p,sha256:hash(p),report});
  }
  const actions=run.actions,count=name=>actions.filter(a=>a.name===name).length;
  assert(count('ConnectWire')>=10&&actions.some(a=>a.name.startsWith('SlotHit')),'first manual construction');
  assert(count('MonthEnd')===6);assert(count('Custom1')+count('Custom2')>0,'revision/rework');
  browser.push({route,months:6,successfulSales:sum(run.state.reports,'sold'),failedDeliveries:run.state.finished.filter(u=>u.deliveryOutcome==='arrival_defect').length,cash:rounds(run.state.cash),profit:rounds(sum(run.state.reports,'profit')),reputation:run.state.reputation,investments:run.state.investments,automatedWallMs:run.automatedWallMs,actionCount:actions.length,nextWorkClicks:count('NextWork'),manualConnections:count('ConnectWire'),mode:'UI clicks only; read-only state capture; no funds/month/inventory injection',ending:base+'/ending.json',endingSha256:hash(base+'/ending.json'),checkpoints});
}
const viewChecks=read('.local/playtests/v3/case-views/runtime-checks.json');
assert.equal(viewChecks.length,9);assert(viewChecks.every(v=>v.loading===0));
const dragChecks=read('.local/playtests/v3/case-views/drag-checks.json');assert.equal(dragChecks.rearDragMovedSlot,'ssd1');assert.equal(dragChecks.rearClickRestoredSlot,'ssd0');
const report={recordedAt:new Date().toISOString(),creatorVersion:read('package.json').creator.version,environment:{os:'Windows',browser:'Codex in-app Chromium',preview:'http://127.0.0.1:7456/',viewport:'390x844',interaction:'canvas clicks / native browser form input',humanPlaytime:'not-verified'},builds:{web:{status:'passed-release-build',...digest('build/web-desktop')},wechat:{status:'passed-release-build',...digest('build/wechatgame')}},runtimeSources:digest('assets/scripts'),runtimeArtwork:digest('assets/art'),dataBaseline:read('design/demo-baseline.json'),frozenEconomyBaseline:{sha256:hash('design/balance-baseline.json'),diff:'unchanged'},integration:{partsThread:'01a114d3-66c4-76b1-8bd0-b9e636bfc42e',uiThread:'01a11e53-f111-77c2-a683-8f6a8bfb561e',uiRecord:'art/figma/ui-demo-verification-v03.json',coreCatalogEntries:32,installationMappings:39,uiExports:22},rules,browser,workbench:{views:viewChecks,drag:dragChecks,ui:read('.local/playtests/v3/case-views/ui-checks.json'),evidence:'.local/playtests/v3/case-views',viewport:'1280x720, portrait letterboxed',collision:'fixed-view only; no full 3D claim'},package:read('.local/package-measurement.json'),checks:{tests:52,typecheck:'passed',design:'passed',suppliers:'passed',designToGame:'passed',flow:'passed',uiArt:'passed'},wechatSimulator:{status:'computer-use-stopped-in-current-turn',login:'user-confirmed-complete; UI not re-inspected',requestedHumanAction:'Start a new turn to resume simulator validation after Escape stopped Computer Use',routesCompleted:0,previousBlockerScreenshot:'.local/playtests/wechat-login-required.jpg',olderEvidence:'docs/wechat-simulator-test.md'},realDevice:'not-verified',humanTwoToThreeHours:'not-verified',historicalEvidence:{priorBuild:'docs/demo-verification.json (original fields preserved)',beforeInputFix:'.local/playtests/v2',naturalDefect:'.local/playtests/v2/boutique/run.json',failedScaleStrategy:'.local/playtests/browser-scale-exploration.json',excluded:'v1 flat per-month filenames reused across routes; do not use as route checkpoints'},remaining:['WeChat simulator three routes over six months','human full playtest duration','account association and cloud saves','physical device verification','full 3D collision','all appearance textures and fan animation']};
write('docs/six-month-verification.json',report);
const existing=read('docs/demo-verification.json');existing.sixMonthImplementation={recordedAt:report.recordedAt,record:'docs/six-month-verification.json',browser:'3 normal routes, 6 months each, UI played',wechatBuild:'passed',wechatSimulator:report.wechatSimulator.status,realDevice:'not-verified',humanDuration:'not-verified'};write('docs/demo-verification.json',existing);
console.log(JSON.stringify({record:'docs/six-month-verification.json',rules:rules.map(({route,sales,cash})=>({route,sales,cash})),browser:browser.map(({route,successfulSales,failedDeliveries,cash,profit,actionCount,nextWorkClicks})=>({route,successfulSales,failedDeliveries,cash,profit,actionCount,nextWorkClicks})),webBuild:report.builds.web.sha256,wechatBuild:report.builds.wechat.sha256},null,2));
