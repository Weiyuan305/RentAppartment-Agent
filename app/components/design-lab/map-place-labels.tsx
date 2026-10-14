"use client";
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import type * as Cesium from "cesium";
import { GraduationCap, Icon } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { displayCity } from "@/lib/i18n";
import { amenityInfo, type Amenity } from "@/lib/amenities";
import { amenityIconNodes } from "@/lib/amenity-icons";
import { priceLabel, type City, type Listing } from "@/lib/rental-data";

export type LabelScene = {C: typeof Cesium; viewer: Cesium.Viewer};
type PlaceLabel = {id: string; kind: "listing" | "campus" | "place"; lng: number; lat: number; text: string; name: string};

export function fitMapLabelTarget({C,viewer}: LabelScene, lng: number, lat: number, range=1200, heading=0) {
  if (viewer.isDestroyed()) return;
  const canvas=viewer.canvas.getBoundingClientRect(), panel=viewer.canvas.closest(".city-panel");
  const tools=panel?.querySelector(".concept-amenity-disclosure")?.getBoundingClientRect();
  const card=panel?.querySelector(".map-selected,.map-amenity-selected,.map-route,.map-transit")?.getBoundingClientRect();
  const top=tools ? tools.bottom-canvas.top+20 : 100;
  const bottom=card ? Math.max(top+45,card.top-canvas.top-15) : canvas.height-110;
  const tangent=viewer.camera.frustum instanceof C.PerspectiveFrustum ? Math.tan((viewer.camera.frustum.fovy ?? Math.PI/3)/2) : .58;
  const location=C.Cartographic.fromDegrees(lng,lat);
  const height=viewer.scene.sampleHeightSupported ? viewer.scene.sampleHeight(location,viewer.entities.values) : undefined;
  viewer.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(lng,lat,(height ?? 0)+3),40),{
    duration:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1.2,
    offset:new C.HeadingPitchRange(heading,-.85,range),
    complete:()=>{
      if(viewer.isDestroyed()) return;
      const settled=viewer.scene.sampleHeightSupported ? viewer.scene.sampleHeight(location,viewer.entities.values) : height;
      const anchor=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,C.Cartesian3.fromDegrees(lng,lat,(settled ?? 0)+3));
      // Reserve room above the anchor for the label, including newly loaded roof geometry.
      const target=top+(bottom-top)*.72;
      viewer.camera.moveDown(((anchor?.y ?? canvas.height/2)-target)/canvas.height*2*range*tangent);
      viewer.scene.requestRender();
    },
  });
}

export default function MapPlaceLabels({scene, city, listings, selected, place, routeActive, hideCampus=false,onSelect, onCampus, onPlace}: {
  scene: LabelScene | null; city: City; listings: Listing[]; selected: string; place?: Amenity; routeActive: boolean;hideCampus?:boolean;
  onSelect: (id: string) => void; onCampus: () => void; onPlace: (id: string) => void;
}) {
  const {locale} = useLocale();
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const labels = useMemo<PlaceLabel[]>(()=>[
    ...(!routeActive ? listings.map(l=>({id:l.id,kind:"listing" as const,lng:l.lng,lat:l.lat,text:priceLabel(l),name:l.name})) : []),
    ...(!routeActive&&!hideCampus ? [{id:"campus",kind:"campus" as const,lng:city.lng,lat:city.lat,text:displayCity(city,locale).university,name:displayCity(city,locale).university}] : []),
    ...(place ? [{id:place.id,kind:"place" as const,lng:place.lng,lat:place.lat,text:place.name,name:place.name}] : []),
  ],[city,listings,locale,place,routeActive,hideCampus]);

  useEffect(()=>{
    if (!scene || scene.viewer.isDestroyed()) return;
    const {C,viewer}=scene;
    const positions = new Map<string, Cesium.Cartesian3>();
    const screen = new C.Cartesian2(), direction = new C.Cartesian3();
    let sampledAt = -Infinity;
    function positionLabels() {
      if (viewer.isDestroyed()) return;
      const resample = performance.now()-sampledAt>500;
      if (resample) sampledAt=performance.now();
      const width=viewer.canvas.clientWidth, height=viewer.canvas.clientHeight;
      const layouts = new Map<string, {left:number;top:number;right:number;bottom:number;node:HTMLDivElement}>();
      for (const label of labels) {
        const node=nodes.current.get(label.id); if (!node) continue;
        const anchor=node.querySelector<HTMLElement>(".map-marker-anchor")!;
        const leader=node.querySelector<SVGElement>(".map-marker-leader");
        anchor.style.transform="";
        if (leader) leader.style.visibility="hidden";
        if (resample || !positions.has(label.id)) {
          const location=C.Cartographic.fromDegrees(label.lng,label.lat);
          const sampled=viewer.scene.sampleHeightSupported ? viewer.scene.sampleHeight(location,viewer.entities.values) : undefined;
          positions.set(label.id,C.Cartesian3.fromDegrees(label.lng,label.lat,(sampled ?? 0)+3));
        }
        const world=positions.get(label.id)!;
        C.Cartesian3.subtract(world,viewer.camera.positionWC,direction);
        const visible=C.Cartesian3.dot(direction,viewer.camera.directionWC)>0;
        const p=visible ? C.SceneTransforms.worldToWindowCoordinates(viewer.scene,world,screen) : undefined;
        const inView=p && p.x>=0 && p.x<=width && p.y>=0 && p.y<=height && width>1 && height>1;
        node.style.visibility=inView ? "visible" : "hidden";
        if (inView && p) {
          // Whole CSS pixels keep text sharp while the camera moves. No React frame updates.
          const transform=`translate3d(${Math.round(p.x)}px,${Math.round(p.y)}px,0)`;
          if (node.style.transform!==transform) node.style.transform=transform;
          const bottom=Math.round(p.y)-(label.kind==="place" && routeActive ? 33 : 8);
          layouts.set(label.id,{left:Math.round(p.x)-anchor.offsetWidth/2,top:bottom-anchor.offsetHeight,right:Math.round(p.x)+anchor.offsetWidth/2,bottom,node});
        }
      }
      const price=layouts.get(selected), poi=place && layouts.get(place.id);
      const overlaps=(a:{left:number;top:number;right:number;bottom:number},b:{left:number;top:number;right:number;bottom:number})=>a.left<b.right+6 && a.right>b.left-6 && a.top<b.bottom+6 && a.bottom>b.top-6;
      if (price && poi && overlaps(price,poi)) {
        const bounds=viewer.canvas.getBoundingClientRect(), panel=viewer.canvas.closest(".city-panel");
        const tools=panel?.querySelector(".concept-amenity-disclosure")?.getBoundingClientRect();
        const card=panel?.querySelector(".map-amenity-selected")?.getBoundingClientRect();
        const top=tools ? tools.bottom-bounds.top+8 : 8, bottom=card ? card.top-bounds.top-8 : height-8;
        const offsets=[{x:0,y:-(poi.bottom-poi.top+8)},{x:price.right-poi.left+10,y:0},{x:price.left-poi.right-10,y:0},{x:0,y:price.bottom-poi.top+10}];
        const clear=offsets.find(({x,y})=>{
          const candidate={left:poi.left+x,top:poi.top+y,right:poi.right+x,bottom:poi.bottom+y};
          return candidate.left>=8 && candidate.right<=width-8 && candidate.top>=top && candidate.bottom<=bottom && !overlaps(candidate,price);
        });
        if (clear) {
          poi.node.querySelector<HTMLElement>(".map-marker-anchor")!.style.transform=`translate(-50%,0) translate(${clear.x}px,${clear.y}px)`;
          const leader=poi.node.querySelector<SVGElement>(".map-marker-leader")!;
          const line=leader.querySelector("line")!;
          line.setAttribute("x2",String(clear.x));line.setAttribute("y2",String(clear.y-8));leader.style.visibility="visible";
        }
      }
    }
    const remove=viewer.scene.postRender.addEventListener(positionLabels);
    positionLabels();
    return ()=>remove();
  },[scene,labels,selected,place,routeActive]);

  if (!scene) return null;
  return <div className="map-screen-labels" aria-label={locale==="zh" ? "地图地点标记" : "Map place markers"}>
    {labels.map(label=>{
      const active=label.kind==="listing" && label.id===selected;
      const prefix=locale==="zh" ? {listing:"地图房源",campus:"地图大学",place:"地图设施"} : {listing:"Map apartment",campus:"Map university",place:"Map amenity"};
      return <div key={label.id} ref={node=>{if(node)nodes.current.set(label.id,node);else nodes.current.delete(label.id);}} className={`map-screen-marker ${active ? "is-selected" : ""} ${label.kind} ${routeActive ? "on-route" : ""}`} style={{visibility:"hidden"}}>
        {label.kind==="place" && <svg className="map-marker-leader" width="1" height="1" aria-hidden="true"><line x1="0" y1="0"/><circle cx="0" cy="0" r="2"/></svg>}
        <div className="map-marker-anchor"><button className="map-marker-button" title={label.name} aria-label={`${prefix[label.kind]}: ${label.name}${label.kind==="listing" ? `, ${label.text}` : ""}`} aria-pressed={label.kind==="listing" ? active : undefined}
          style={label.kind==="place" && place ? {"--marker-accent":amenityInfo[place.category].color} as CSSProperties : undefined}
          onClick={()=>{if(label.kind==="listing")onSelect(label.id);else if(label.kind==="campus")onCampus();else onPlace(label.id);}}>
          {label.kind==="campus" && <GraduationCap size={17} strokeWidth={1.8}/>}
          {label.kind==="place" && place && <Icon iconNode={amenityIconNodes[place.category]} size={17} strokeWidth={1.8}/>}
          <span className="map-marker-copy">{label.text}</span>
        </button><span className="map-marker-stem" aria-hidden="true"/></div>
      </div>;
    })}
  </div>;
}
