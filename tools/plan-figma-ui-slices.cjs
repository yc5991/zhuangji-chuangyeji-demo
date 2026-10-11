// Analyze original pixels to describe editable Figma vector masks. No raster exports are made here.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const sharp=require(require.resolve('sharp',{paths:[process.env.ORANGE_ART_NODE_MODULES||'']}));
const boxes=[
 ['workshop',28,123,201,218],['product',248,135,204,208],['procurement',456,137,206,207],['orders',683,136,174,208],['company',875,141,229,202],
 ['calendar',34,450,196,196],['cash',252,449,206,197],['settings',475,460,171,185],['assembly',685,451,195,195],['testing',916,449,169,197],
 ['labor',36,747,196,200],['monthly_report',264,747,199,200],['progress',461,748,204,198],['reputation',690,746,173,200],['supplier',888,758,219,188],
 ['shipping',24,1069,211,171],['warning',261,1066,183,176],['featured',478,1065,190,177],['back',702,1078,160,164],['forward',914,1081,175,161]
];
function simplify(p,epsilon=.6){
 if(p.length<4)return p;
 const [a,b]=[p[0],p[p.length-1]],dx=b[0]-a[0],dy=b[1]-a[1];let max=0,idx=0;
 for(let i=1;i<p.length-1;i++){const t=Math.max(0,Math.min(1,((p[i][0]-a[0])*dx+(p[i][1]-a[1])*dy)/(dx*dx+dy*dy||1)));const dist=Math.hypot(p[i][0]-a[0]-t*dx,p[i][1]-a[1]-t*dy);if(dist>max){max=dist;idx=i;}}
 return max>epsilon?[...simplify(p.slice(0,idx+1),epsilon).slice(0,-1),...simplify(p.slice(idx),epsilon)]:[a,b];
}
function contour(rgb,sw,x0,y0,w,h,preserveSilver=false){
 const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let start=0,end=0;
 const cream=i=>{const x=i%w,y=Math.floor(i/w),p=((y+y0)*sw+x+x0)*3,r=rgb[p],g=rgb[p+1],b=rgb[p+2];return preserveSilver?r>=236&&g>=225&&b>=202&&r-g<34:r>=213&&g>=178&&b>=128&&r-g<65;};
 const add=i=>{if(i>=0&&i<w*h&&!seen[i]&&cream(i)){seen[i]=1;queue[end++]=i;}};
 for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
 while(start<end){const i=queue[start++],x=i%w,y=Math.floor(i/w);if(x)add(i-1);if(x<w-1)add(i+1);if(y)add(i-w);if(y<h-1)add(i+w);}
 // Remove exterior speckle components but preserve enclosed cream fills and orange accent rays.
 const visited=new Uint8Array(w*h),keep=new Uint8Array(w*h);let bounds=[w,h,0,0];
 for(let i=0;i<w*h;i++)if(!seen[i]&&!visited[i]){const component=[i];visited[i]=1;for(let n=0;n<component.length;n++){const p=component[n],x=p%w,y=Math.floor(p/w);for(const q of [x?p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1])if(q>=0&&!seen[q]&&!visited[q]){visited[q]=1;component.push(q);}}if(component.length>=20)for(const p of component){keep[p]=1;const x=p%w,y=Math.floor(p/w);bounds=[Math.min(bounds[0],x),Math.min(bounds[1],y),Math.max(bounds[2],x+1),Math.max(bounds[3],y+1)];}}
 const edges=new Map(),at=(x,y)=>x>=0&&x<w&&y>=0&&y<h&&keep[y*w+x];
 const edge=(x,y,a,b)=>{const key=y*(w+1)+x;if(!edges.has(key))edges.set(key,[]);edges.get(key).push([a,b]);};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(at(x,y)){if(!at(x,y-1))edge(x,y,x+1,y);if(!at(x+1,y))edge(x+1,y,x+1,y+1);if(!at(x,y+1))edge(x+1,y+1,x,y+1);if(!at(x-1,y))edge(x,y+1,x,y);}
 const loops=[];while(edges.size){const key=edges.keys().next().value,first=[key%(w+1),Math.floor(key/(w+1))];let p=first,loop=[p];for(let guard=0;guard<w*h*4;guard++){const k=p[1]*(w+1)+p[0],next=edges.get(k);if(!next?.length)break;p=next.pop();if(!next.length)edges.delete(k);loop.push(p);if(p[0]===first[0]&&p[1]===first[1])break;}if(loop.length>4){const mid=Math.floor(loop.length/2);loops.push([...simplify(loop.slice(0,mid+1)),...simplify(loop.slice(mid)).slice(1)]);}}
 const [l,t,r,b]=bounds;const maskPath=loops.map(points=>points.map((p,i)=>`${i?'L':'M'}${p[0]-l},${p[1]-t}`).join(' ')+'Z').join(' ');
 return {sourceRect:[x0+l,y0+t,r-l,b-t],maskPath,contours:loops.length};
}
(async()=>{
 const source='art/source/ui/reference_icons_v01.png',raw=await sharp(path.join(root,source)).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const entries=boxes.map(([name,x,y,w,h])=>({name,source,sourceHash:'075a293f5d9ccabedb6c93225cd012b5986b79d5',...contour(raw.data,raw.info.width,x,y,w,h,name==='assembly'),canvasPx:[192,192],paddingPx:14,exportPath:`art/exports/ui/icons/${name}.png`,runtimePath:`assets/art/workbench/ui/icons/${name}.png`}));
 const originalNames={25:'reference_workshop_v01',32:'reference_products_v01',37:'reference_icons_v01',40:'reference_orders_v01',45:'reference_company_v01',48:'reference_objects_v01'};
 const sources=Object.entries(originalNames).map(([num,name])=>{const file=`art/source/ui/${name}.png`,original=`ui-demos/ChatGPT Image 2026年10月9日 00_29_${num}.png`;if(!fs.existsSync(path.join(root,file)))fs.copyFileSync(path.join(root,original),path.join(root,file));return {path:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')};});
 const plan={schemaVersion:2,fileKey:'1Pd44NBRzvtRWywj1V4bz5',pageId:'1:2',method:'source pixels analyzed for border-connected cream; contours become editable Figma bitmap-fill vector masks; all sprites exported by Figma',sources,entries};
 fs.writeFileSync(path.join(root,'art/figma/ui-slice-plan-v02.json'),JSON.stringify(plan,null,2)+'\n');console.log(JSON.stringify(plan));
})().catch(e=>{console.error(e);process.exitCode=1;});
