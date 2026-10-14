import { mapOccluders, markerOverlaps, type MarkerBounds } from "./map-marker-density";

/** Largest real, unobstructed rectangle. Never invent space outside the canvas. */
export function availableMapRect(width: number, height: number, obstacles: MarkerBounds[], padding = 16): MarkerBounds {
  const inset = Math.min(padding, width / 4, height / 4);
  const frame = { left: inset, top: inset, right: width - inset, bottom: height - inset };
  const blocks = obstacles.map(r => ({left:Math.max(frame.left,r.left-padding),top:Math.max(frame.top,r.top-padding),right:Math.min(frame.right,r.right+padding),bottom:Math.min(frame.bottom,r.bottom+padding)})).filter(r=>r.left<r.right && r.top<r.bottom);
  const xs = [...new Set([frame.left,frame.right,...blocks.flatMap(r=>[r.left,r.right])])].sort((a,b)=>a-b);
  const ys = [...new Set([frame.top,frame.bottom,...blocks.flatMap(r=>[r.top,r.bottom])])].sort((a,b)=>a-b);
  let best = {left:frame.left,top:frame.top,right:frame.left,bottom:frame.top}, score = -1;
  for(let l=0;l<xs.length-1;l++) for(let r=l+1;r<xs.length;r++) {
    for(let t=0;t<ys.length-1;t++) for(let b=t+1;b<ys.length;b++) {
      const rect={left:xs[l],right:xs[r],top:ys[t],bottom:ys[b]};
      if(blocks.some(block=>markerOverlaps(rect,block,0)))continue;
      // Discourage unusable slivers without exceeding actual available space.
      const w=rect.right-rect.left,h=rect.bottom-rect.top;
      const value=w*h*Math.min(1,Math.min(w,h)/120);
      if(value>score){best=rect;score=value;}
    }
  }
  return best;
}

export function readMapViewport(canvas: HTMLCanvasElement) {
  return availableMapRect(canvas.clientWidth,canvas.clientHeight,mapOccluders(canvas));
}
