const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../build/web-desktop');
const port=Number(process.argv[2]||7456);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Choose a valid local port.');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.wasm':'application/wasm','.css':'text/css'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'),target=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(target,(error,data)=>{if(error){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
});
let selectedPort=port;
server.on('error',error=>{
  // Keep double-click startup usable when the development preview occupies its default port.
  if(error.code==='EADDRINUSE'&&(process.argv.includes('--open')||process.argv.includes('--fallback-port'))&&selectedPort<Math.min(port+10,65535)){
    selectedPort++;
    server.listen(selectedPort,'127.0.0.1');
  }else{throw error;}
});
server.on('listening',()=>{
  const url='http://127.0.0.1:'+selectedPort+'/';
  console.log('装机创业记 preview: '+url);
  // The user-facing Windows launcher opens the page after the server is listening.
  if(process.argv.includes('--open')&&process.platform==='win32'){
    require('node:child_process').exec('start "" "'+url+'"',{windowsHide:true});
  }
});
server.listen(selectedPort,'127.0.0.1');
