const {test}=require('node:test'),assert=require('node:assert/strict');
const {artLayout,containedArtLayout}=require('../.local/tests/art-layout');
test('transparent export padding does not compress a component body, and top-origin outlines map to bottom-origin installation',()=>{
 const art={outlinePx:[10,20,80,60],pivot:[.5,.5]},layout=artLayout(art,[100,100],[30,40,160,120]);
 assert.deepEqual(layout.imageRect,[10,0,200,200]);assert.deepEqual(layout.anchor,[110,100]);
 // Transform the measured body's lower-left and upper-right corners back into case millimetres.
 assert.deepEqual([layout.imageRect[0]+10*2,layout.imageRect[1]+(100-20-60)*2],[30,40]);
 assert.deepEqual([layout.imageRect[0]+90*2,layout.imageRect[1]+(100-20)*2],[190,160]);
});
test('body rectangle excludes connector protrusions while retaining the complete untrimmed artwork',()=>{
 const art={outlinePx:[0,0,100,100],bodyRectLtrbPx:[10,10,90,90],pivot:[.25,.75]},layout=artLayout(art,[100,100],[0,0,80,80]);
 assert.deepEqual(layout.imageRect,[-10,-10,100,100]);assert.deepEqual(layout.anchor,[15,65]);
 assert.throws(()=>artLayout({...art,bodyRectLtrbPx:[10,10,110,90]},[100,100],[0,0,80,80]));
});

test('exterior view contains the measured silhouette with uniform scaling and centers transparent padding',()=>{
 const art={outlinePx:[10,20,80,60],bodyRectLtrbPx:[0,0,100,100],pivot:[.5,.5]};
 const result=containedArtLayout(art,[100,100],[0,0,160,160]);
 assert.deepEqual(result.imageRect,[-20,-20,200,200]);assert.deepEqual(result.anchor,[80,80]);
 assert.equal(result.width/100,result.height/100);
});
