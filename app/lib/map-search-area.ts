import { z } from "zod";
export const mapSearchAreaSchema = z.object({
  id: z.string().uuid(),
  polygon: z.array(z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)])).length(4),
});
export type MapSearchArea = z.infer<typeof mapSearchAreaSchema>;

/** Ground footprint, including its boundary. Unwrap around one polygon vertex. */
export function inMapSearchArea(lng: number, lat: number, area?: MapSearchArea | null) {
  if (!area) return true;
  const anchor=area.polygon[0][0], wrap=(x:number)=>((x+540)%360)-180;
  const query=wrap(lng-anchor);
  const points = area.polygon.map(([x,y]) => [wrap(x-anchor)-query,y-lat]);
  let inside = false;
  for (let i=0,j=points.length-1;i<points.length;j=i++) {
    const [x,y]=points[i], [a,b]=points[j];
    const cross=x*b-a*y;
    if (Math.abs(cross)<1e-10 && x*a+y*b<=0) return true;
    if ((y>0)!==(b>0) && 0<(a-x)*(-y)/(b-y)+x) inside=!inside;
  }
  return inside;
}
