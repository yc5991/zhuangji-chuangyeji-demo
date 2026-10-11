import type {RuntimeArt} from './types';

/** Map the measured body, rather than transparent export padding, onto a physical installation rectangle. */
export function artLayout(art:RuntimeArt,exportSize:number[],target:number[]) {
  const [width,height]=exportSize;
  const [left,top,bodyWidth,bodyHeight]=art.bodyRectLtrbPx
    ?[art.bodyRectLtrbPx[0],art.bodyRectLtrbPx[1],art.bodyRectLtrbPx[2]-art.bodyRectLtrbPx[0],art.bodyRectLtrbPx[3]-art.bodyRectLtrbPx[1]]
    :art.outlinePx;
  if(![width,height,bodyWidth,bodyHeight,target[2],target[3]].every(n=>Number.isFinite(n)&&n>0)||left<0||top<0||left+bodyWidth>width||top+bodyHeight>height)throw new Error('素材轮廓超出完整导出尺寸');
  const scaleX=target[2]/bodyWidth,scaleY=target[3]/bodyHeight;
  const fullWidth=width*scaleX,fullHeight=height*scaleY;
  // Pixel outlines start at the top left; the engine and physical rectangle start at the bottom left.
  const x=target[0]-left*scaleX,y=target[1]-(height-top-bodyHeight)*scaleY;
  return {width:fullWidth,height:fullHeight,anchor:[x+fullWidth*art.pivot[0],y+fullHeight*art.pivot[1]],imageRect:[x,y,fullWidth,fullHeight]};
}

/** Exterior photos retain their perspective and aspect ratio within the fixed display area. */
export function containedArtLayout(art:RuntimeArt,exportSize:number[],target:number[]) {
  const [, ,w,h]=art.outlinePx,scale=Math.min(target[2]/w,target[3]/h);
  const body=[target[0]+(target[2]-w*scale)/2,target[1]+(target[3]-h*scale)/2,w*scale,h*scale];
  return artLayout({...art,bodyRectLtrbPx:undefined},exportSize,body);
}
