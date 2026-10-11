// Inspect alpha bounds only; Figma performs the actual masking, scaling and raster export.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),sharp=require(require.resolve('sharp',{paths:[process.env.ORANGE_ART_NODE_MODULES||'']}));
const boxes=[
 ['card_plain',5,135,315,347],['card_leaf',321,135,622,347],['wood_sign',625,180,925,305],['title_ribbon',929,180,1253,309],
 ['button_normal',5,409,315,536],['button_pressed',321,409,622,536],['button_secondary',625,409,927,536],['button_disabled',929,409,1253,536],
 ['tab_selected',5,658,315,789],['tab_normal',321,658,622,789],['input_field',625,658,927,789],['nav_selected',959,580,1208,845],
 ['dialog_paper',5,849,320,1143],['progress_track',321,975,622,1037],['badge_green',625,931,927,1069],['badge_blue',929,931,1253,1069]
];
(async()=>{
 const source='art/source/ui/full-v03/materials_v03.png',portraitSource='art/source/ui/full-v03/portraits_v03.png';
 const {data,info}=await sharp(path.join(root,source)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const entries=boxes.map(([name,l,t,r,b],index)=>{
   // Source coordinates describe visually inspected neighborhoods in the actual generated 1254px sheet.
   l=Math.round(l*info.width/1254);r=Math.min(info.width,Math.round(r*info.width/1254));t=Math.round(t*info.height/1254);b=Math.min(info.height,Math.round(b*info.height/1254));
   let bounds=[r,b,l,t];for(let y=t;y<b;y++)for(let x=l;x<r;x++)if(data[(y*info.width+x)*4+3]>=40)bounds=[Math.min(bounds[0],x),Math.min(bounds[1],y),Math.max(bounds[2],x+1),Math.max(bounds[3],y+1)];
   const sx=Math.max(l,bounds[0]-3),sy=Math.max(t,bounds[1]-3),sw=Math.min(r,bounds[2]+3)-sx,sh=Math.min(b,bounds[3]+3)-sy;
   const scale=Math.min(384/sw,384/sh),w=Math.round(sw*scale),h=Math.round(sh*scale);
   const border=name==='progress_track'?[30,8,30,8]:name==='nav_selected'?[44,44,44,44]:name==='dialog_paper'?[46,46,46,64]:name.startsWith('card_')?[64,62,68,54]:name.startsWith('tab_')?[64,38,64,38]:[84,44,84,44];
   return {name,kind:'surface',source,sourcePx:[info.width,info.height],sourceRect:[sx,sy,sw,sh],atlasRect:[index%4*384,Math.floor(index/4)*384,w,h],border};
 });
 for(let i=0;i<6;i++)entries.push({name:'client_'+i,kind:'portrait',source:portraitSource,sourcePx:[1536,1024],sourceRect:[i%3*512+24,Math.floor(i/3)*512+4,464,464],atlasRect:[i*256,1552,192,192],border:[0,0,0,0],cornerRadius:96});
 const sha256=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
 const plan={schemaVersion:1,clientDate:'2026-10-11',fileKey:'1Pd44NBRzvtRWywj1V4bz5',pageId:'1:2',atlas:{width:1536,height:1744,exportPath:'art/exports/ui/full-v03/full-ui-atlas-v03.png'},sources:[{path:source,sha256:sha256(source),nodeId:'38:2',imageHash:'61dd1e455bb2436b7f8ba527a78330f0951aeab1'},{path:portraitSource,sha256:sha256(portraitSource),nodeId:'38:3',imageHash:'69049cd48642d7904d2fa897d0352ab20c6a1eab'}],entries};
 fs.writeFileSync(path.join(root,'art/figma/full-ui-slice-plan-v03.json'),JSON.stringify(plan,null,2)+'\n');console.log(`Planned ${entries.length} Figma crops from untouched generated artwork.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
