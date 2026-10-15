"use client";
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import type * as Cesium from "cesium";
import { GraduationCap, Icon } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { displayCity } from "@/lib/i18n";
import { amenityInfo, type Amenity } from "@/lib/amenities";
import { amenityIconNodes } from "@/lib/amenity-icons";
import { priceLabel, type City, type Listing } from "@/lib/rental-data";

import {chooseMapMarkers, mapOccluders, markerOverlaps, placeMapLabel, type LabelOffset, type MarkerCandidate} from "@/lib/map-marker-density";
import {mapMotion} from "@/lib/map-motion";
import {readMapViewport} from "@/lib/map-viewport";

export type LabelScene = {C: typeof Cesium; viewer: Cesium.Viewer};
type PlaceLabel = {id: string; kind: "listing" | "campus" | "place"; lng: number; lat: number; text: string; name: string};

export function fitMapLabelTarget({C,viewer}: LabelScene, lng: number, lat: number, range=1200, heading?:number, force=false) {
  if (viewer.isDestroyed()) return;
  const canvas=viewer.canvas.getBoundingClientRect();
  const {top,bottom,left,right}=readMapViewport(viewer.canvas);
  if(right-left<40 || bottom-top<40)return;
  viewer.camera.cancelFlight();
  const tangent=viewer.camera.frustum instanceof C.PerspectiveFrustum ? Math.tan((viewer.camera.frustum.fovy ?? Math.PI/3)/2) : .58;
  const location=C.Cartographic.fromDegrees(lng,lat);
  const height=viewer.scene.sampleHeightSupported ? viewer.scene.sampleHeight(location,viewer.entities.values) : undefined;
  const target=C.Cartesian3.fromDegrees(lng,lat,(height ?? 0)+3), motion=mapMotion(C,viewer,target);
  if(motion.visible && heading===undefined && !force){viewer.scene.requestRender();return;}
  viewer.camera.flyToBoundingSphere(new C.BoundingSphere(target,40),{
    duration:motion.duration,
    offset:new C.HeadingPitchRange(heading??viewer.camera.heading,Math.max(-1.35,Math.min(-.65,viewer.camera.pitch)),range),
    complete:()=>{
      if(viewer.isDestroyed()) return;
      const settled=viewer.scene.sampleHeightSupported ? viewer.scene.sampleHeight(location,viewer.entities.values) : height;
      const anchor=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,C.Cartesian3.fromDegrees(lng,lat,(settled ?? 0)+3));
      // Reserve room above the anchor for the label, including newly loaded roof geometry.
      const target=top+(bottom-top)*.72;
      viewer.camera.moveRight((canvas.width/2-(left+right)/2)/canvas.height*2*range*tangent);
      viewer.camera.moveDown(((anchor?.y ?? canvas.height/2)-target)/canvas.height*2*range*tangent);
      viewer.scene.requestRender();
    },
  });
}

export default function MapPlaceLabels({scene, city, listings, selected, place, routeActive, hideCampus=false,hovered,onHover,onSelect, onCampus, onPlace}: {
  scene: LabelScene | null; city: City; listings: Listing[]; selected: string; place?: Amenity; routeActive: boolean;hideCampus?:boolean;
  hovered: string | null; onHover: (id: string | null) => void;
  onSelect: (id: string) => void; onCampus: () => void; onPlace: (id: string) => void;
}) {
  const {locale} = useLocale();
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const labels = useMemo<PlaceLabel[]>(()=>[
    ...((!routeActive ? listings : listings.filter(l=>l.id===selected)).map(l=>({id:l.id,kind:"listing" as const,lng:l.lng,lat:l.lat,text:priceLabel(l),name:l.name}))),
    ...(!routeActive&&!hideCampus ? [{id:"campus",kind:"campus" as const,lng:city.lng,lat:city.lat,text:displayCity(city,locale).university,name:displayCity(city,locale).university}] : []),
    ...(place ? [{id:place.id,kind:"place" as const,lng:place.lng,lat:place.lat,text:place.name,name:place.name}] : []),
  ],[city,listings,locale,place,routeActive,hideCampus,selected]);

  useEffect(()=>{
    if (!scene || scene.viewer.isDestroyed()) return;
    const {C,viewer}=scene;
    const positions = new Map<string, Cesium.Cartesian3>();
    const screen = new C.Cartesian2(), direction = new C.Cartesian3();
    let sampledAt = -Infinity;
    const offsets = new Map<string, LabelOffset>();
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
        node.classList.remove("is-compact");
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
      const occluders=mapOccluders(viewer.canvas), candidates:MarkerCandidate[]=[], occupied=[...occluders];
      const frame={left:8,top:8,right:width-8,bottom:height-8};
      const focused=[...layouts].find(([,box])=>box.node.contains(document.activeElement))?.[0];
      // Selected price gets first choice. Place names adapt without covering it.
      for(const id of new Set([selected,place?.id,focused])) {
        if(!id)continue;
        const box=layouts.get(id);if(!box)continue;
        const anchor=box.node.querySelector<HTMLElement>(".map-marker-anchor")!;
        let offset=placeMapLabel(box,frame,occupied,offsets.get(id));
        if(!offset && id===place?.id) {
          box.node.classList.add("is-compact");
          const center=(box.left+box.right)/2;
          box.left=center-anchor.offsetWidth/2;box.right=center+anchor.offsetWidth/2;box.top=box.bottom-anchor.offsetHeight;
          offset=placeMapLabel(box,frame,occupied,offsets.get(id));
        }
        if(!offset){box.node.style.visibility="hidden";layouts.delete(id);continue;}
        offsets.set(id,offset);
        const {x,y}=offset;
        anchor.style.transform=`translateX(-50%) translate(${Math.round(x)}px,${Math.round(y)}px)`;
        const leader=box.node.querySelector<SVGElement>(".map-marker-leader")!;
        if(x || y){const line=leader.querySelector("line")!;line.setAttribute("x2",String(x));line.setAttribute("y2",String(y-8));leader.style.visibility="visible";}
        box.left+=x;box.right+=x;box.top+=y;box.bottom+=y;
        occupied.push(box);
      }
      for(const [id,box] of layouts) {
        const pinned=id===selected || id===place?.id || id===focused;
        if(pinned || !occluders.some(other=>markerOverlaps(box,other,4))) candidates.push({...box,id,priority:box.node.contains(document.activeElement)?20:id===hovered?10:0,pinned});
      }
      const kept=chooseMapMarkers(candidates,viewer.camera.positionCartographic.height>2500 ? 5 : 10,12);
      for(const [id,box] of layouts) if(!kept.has(id))box.node.style.visibility="hidden";

    }
    const remove=viewer.scene.postRender.addEventListener(positionLabels);
    positionLabels();
    const resize=new ResizeObserver(()=>{if(!viewer.isDestroyed())viewer.scene.requestRender();});
    resize.observe(viewer.canvas);
    viewer.scene.requestRender();
    return ()=>{remove();resize.disconnect();};
  },[scene,labels,selected,place,routeActive,hovered]);

  if (!scene) return null;
  return <div className="map-screen-labels" aria-label={locale==="zh" ? "地图地点标记" : "Map place markers"}>
    {labels.map(label=>{
      const active=label.kind==="listing" && label.id===selected;
      const prefix=locale==="zh" ? {listing:"地图房源",campus:"地图大学",place:"地图设施"} : {listing:"Map apartment",campus:"Map university",place:"Map amenity"};
      return <div key={label.id} ref={node=>{if(node)nodes.current.set(label.id,node);else nodes.current.delete(label.id);}} className={`map-screen-marker ${active ? "is-selected" : ""} ${hovered===label.id ? "is-linked" : ""} ${label.kind} ${routeActive ? "on-route" : ""}`} style={{visibility:"hidden"}}>
        {<svg className="map-marker-leader" width="1" height="1" aria-hidden="true"><line x1="0" y1="0"/><circle cx="0" cy="0" r="2"/></svg>}
        <div className="map-marker-anchor"><button className="map-marker-button" title={label.name} aria-label={`${prefix[label.kind]}: ${label.name}${label.kind==="listing" ? `, ${label.text}` : ""}`} aria-pressed={label.kind==="listing" ? active : undefined}
          style={label.kind==="place" && place ? {"--marker-accent":amenityInfo[place.category].color} as CSSProperties : undefined}
          onPointerEnter={()=>{if(label.kind==="listing")onHover(label.id);}} onPointerLeave={()=>onHover(null)} onFocus={()=>{if(label.kind==="listing")onHover(label.id);}} onBlur={()=>onHover(null)} onClick={()=>{if(label.kind==="listing")onSelect(label.id);else if(label.kind==="campus")onCampus();else onPlace(label.id);}}>
          {label.kind==="campus" && <GraduationCap size={17} strokeWidth={1.8}/>}
          {label.kind==="place" && place && <Icon iconNode={amenityIconNodes[place.category]} size={17} strokeWidth={1.8}/>}
          <span className="map-marker-copy">{label.text}</span>
        </button><span className="map-marker-stem" aria-hidden="true"/></div>
      </div>;
    })}
  </div>;
}
