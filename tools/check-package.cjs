const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../build/wechatgame');
if(!fs.existsSync(path.join(root,'game.json')))throw new Error('Build the WeChat release first.');
const config=JSON.parse(fs.readFileSync(path.join(root,'game.json'),'utf8'));
const budget=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../design/demo-baseline.json'),'utf8')).budgetBytes;
const bundles=(config.subpackages||config.subPackages||[]).map(p=>({name:p.name,root:p.root.replace(/\\/g,'/').replace(/\/$/,'')+'/'}));
const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else files.push({path:path.relative(root,file).replace(/\\/g,'/'),bytes:fs.statSync(file).size});}}
walk(root);
const total=files.reduce((n,f)=>n+f.bytes,0),main=files.filter(f=>!bundles.some(b=>f.path.startsWith(b.root))).reduce((n,f)=>n+f.bytes,0);
const report={measuredAt:new Date().toISOString(),kind:'local-build-file-bytes-not-upload-size',fileCount:files.length,mainBytes:main,totalBytes:total,budget,pass:main<=budget.main&&total<=budget.total,subpackages:bundles.map(b=>({...b,bytes:files.filter(f=>f.path.startsWith(b.root)).reduce((n,f)=>n+f.bytes,0)})),largestFiles:files.sort((a,b)=>b.bytes-a.bytes).slice(0,8),wechatUploadBytes:null,simulator:'not-verified',realDevice:'not-verified'};
fs.mkdirSync(path.resolve(__dirname,'../.local'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../.local/package-measurement.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.pass)process.exitCode=1;
