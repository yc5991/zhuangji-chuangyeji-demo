// Package untouched source pixels and editable masks for Figma's ordinary SVG import.
// Rasterization happens in Figma; this script only writes vector markup.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),plan=JSON.parse(fs.readFileSync(path.join(root,'art/figma/ui-slice-plan-v02.json'),'utf8'));
const data=file=>'data:image/png;base64,'+fs.readFileSync(path.join(root,file)).toString('base64');
const images={icons:data('art/source/ui/reference_icons_v01.png'),workshop:data('art/source/ui/reference_workshop_v01.png')};
const defs=[`<image id="icons-source" width="1122" height="1402" href="${images.icons}"/>`,`<image id="workshop-source" width="941" height="1672" href="${images.workshop}"/>`],body=[];
const crop=(id,source,sx,sy,sw,sh,x,y,w,h,flip=false)=>{defs.push(`<clipPath id="clip-${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`);return `<g clip-path="url(#clip-${id})"><use href="#${source}-source" transform="translate(${flip?x+w:x},${y}) scale(${flip?-w/sw:w/sw},${h/sh}) translate(${-sx},${-sy})"/></g>`;};
plan.entries.forEach((e,i)=>{const [sx,sy,sw,sh]=e.sourceRect,s=164/Math.max(sw,sh),x=i%5*192,y=Math.floor(i/5)*192,dx=x+(192-sw*s)/2,dy=y+(192-sh*s)/2;defs.push(`<clipPath id="mask-${e.name}"><path d="${e.maskPath}" fill-rule="evenodd"/></clipPath>`);body.push(`<g id="${e.name}"><rect x="${x}" y="${y}" width="192" height="192" fill="none"/><g transform="translate(${dx},${dy}) scale(${s})" clip-path="url(#mask-${e.name})"><use href="#icons-source" x="${-sx}" y="${-sy}"/></g></g>`);e.atlasRect=[x,y,192,192];});
const assets=[{name:'paper_tile',rect:[0,800,128,128],border:[0,0,0,0]},{name:'wood_tile',rect:[144,800,128,128],border:[0,0,0,0]},{name:'button_primary',rect:[288,800,384,112],border:[42,28,42,28]},{name:'paper_panel',rect:[0,960,384,128],border:[20,20,20,20]}];
body.push(`<g id="paper_tile">${crop('paper','icons',10,10,64,64,0,800,128,128)}</g>`);
body.push(`<g id="wood_tile">${crop('wood','workshop',210,1485,20,125,144,800,128,128)}</g>`);
defs.push('<clipPath id="button-round"><rect x="288" y="800" width="384" height="112" rx="31"/></clipPath>');
body.push(`<g id="button_primary" clip-path="url(#button-round)">${crop('button-left','workshop',174,1325,64,116,288,800,62,112)}${crop('button-middle','workshop',351,1325,30,116,350,800,260,112)}${crop('button-right','workshop',174,1325,64,116,610,800,62,112,true)}</g>`);
defs.push('<clipPath id="panel-round"><rect x="1" y="961" width="382" height="126" rx="15"/></clipPath>');
body.push(`<g id="paper_panel"><g clip-path="url(#panel-round)">${crop('panel-paper','icons',8,8,64,64,0,960,384,128)}</g><rect x="1" y="961" width="382" height="126" rx="15" fill="none" stroke="#CEB48C" stroke-width="2"/></g>`);
const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="960" height="1088" viewBox="0 0 960 1088"><defs>${defs.join('')}</defs>${body.join('')}</svg>`;
fs.writeFileSync(path.join(root,'art/figma/ui-slices-v02.svg'),svg);
// Keep the separately reviewed pale-metal correction reproducible as an editable Figma import.
const assembly=plan.entries.find(e=>e.name==='assembly');
const [ax,ay,aw,ah]=assembly.sourceRect,as=164/Math.max(aw,ah);
const assemblySvg=`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"><defs><clipPath id="mask"><path d="${assembly.maskPath}" fill-rule="evenodd"/></clipPath></defs><g transform="translate(${(192-aw*as)/2},${(192-ah*as)/2}) scale(${as})" clip-path="url(#mask)"><image href="${images.icons}" x="${-ax}" y="${-ay}" width="1122" height="1402"/></g></svg>`;
fs.writeFileSync(path.join(root,'art/figma/assembly-v03.svg'),assemblySvg);
plan.atlas={width:960,height:1088,exportPath:'art/exports/ui/ui-slices-v02.png',materials:assets};fs.writeFileSync(path.join(root,'art/figma/ui-slice-plan-v02.json'),JSON.stringify(plan,null,2)+'\n');console.log('Prepared editable SVG masks for Figma import; original pixels unchanged.');
