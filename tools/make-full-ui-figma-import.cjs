// Package original bitmap pixels and editable crop masks; all raster export is done by Figma.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),plan=JSON.parse(fs.readFileSync(path.join(root,'art/figma/full-ui-slice-plan-v03.json'),'utf8'));
const defs=plan.sources.map((s,i)=>`<image id="source${i}" width="${i?1536:1254}" height="${i?1024:1254}" href="data:image/png;base64,${fs.readFileSync(path.join(root,s.path)).toString('base64')}"/>`);
const groups=plan.entries.map(e=>{const [x,y,w,h]=e.atlasRect,[sx,sy,sw,sh]=e.sourceRect;defs.push(`<clipPath id="clip_${e.name}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${e.cornerRadius||0}"/></clipPath>`);return `<g id="${e.name}" clip-path="url(#clip_${e.name})"><use href="#source${e.kind==='portrait'?1:0}" transform="translate(${x},${y}) scale(${w/sw},${h/sh}) translate(${-sx},${-sy})"/></g>`;});
fs.writeFileSync(path.join(root,'art/figma/full-ui-atlas-v03.svg'),`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${plan.atlas.width}" height="${plan.atlas.height}" viewBox="0 0 ${plan.atlas.width} ${plan.atlas.height}"><defs>${defs.join('')}</defs>${groups.join('')}</svg>`);
console.log('Prepared original bitmap crops for ordinary Figma SVG import.');
