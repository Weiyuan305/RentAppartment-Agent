import type * as Cesium from "cesium";
import {readMapViewport} from "./map-viewport";

export function mapTravelDuration(meters: number, reduced = false) {
  if(reduced)return 0;
  if(meters<300)return .28;
  if(meters<1500)return .4;
  return meters<6000 ? .6 : .85;
}

export function mapMotion(C: typeof Cesium, viewer: Cesium.Viewer, target: Cesium.Cartesian3) {
  const rect=readMapViewport(viewer.canvas), camera=viewer.camera;
  const center=new C.Cartesian2((rect.left+rect.right)/2,(rect.top+rect.bottom)/2);
  const origin=camera.pickEllipsoid(center,viewer.scene.ellipsoid)??camera.positionWC;
  const duration=mapTravelDuration(C.Cartesian3.distance(origin,target),window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const forward=C.Cartesian3.dot(C.Cartesian3.subtract(target,camera.positionWC,new C.Cartesian3()),camera.directionWC)>0;
  const p=forward?C.SceneTransforms.worldToWindowCoordinates(viewer.scene,target):undefined;
  const visible=!!p && camera.positionCartographic.height<5000 && p.x>rect.left+45 && p.x<rect.right-45 && p.y>rect.top+55 && p.y<rect.bottom-35;
  return {duration,visible};
}
