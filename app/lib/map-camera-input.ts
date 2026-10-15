import type * as Cesium from "cesium";
import {bindMapInput, type MapInputMode} from "./map-input";
import {readMapViewport} from "./map-viewport";

export function installMapCameraInput(C: typeof Cesium, viewer: Cesium.Viewer, mode: () => MapInputMode) {
  const {camera,scene,canvas} = viewer;
  const controller = scene.screenSpaceCameraController;
  const originalZoom = controller.zoomEventTypes;
  controller.zoomEventTypes = [C.CameraEventType.RIGHT_DRAG,C.CameraEventType.WHEEL,C.CameraEventType.PINCH,
    {eventType:C.CameraEventType.WHEEL,modifier:C.KeyboardEventModifier.CTRL}];
  let frame = 0, x = 0, y = 0, rotation = 0, scale = 1;
  function schedule() {if(!frame) frame = requestAnimationFrame(flush);}
  function flush() {
    frame = 0;
    const dx=x,dy=y,angle=rotation,ratio=scale;
    x=0;y=0;rotation=0;scale=1;
    if(viewer.isDestroyed() || !controller.enableInputs) return;
    const rect=readMapViewport(canvas);
    const center=new C.Cartesian2((rect.left+rect.right)/2,(rect.top+rect.bottom)/2);
    const pivot=camera.pickEllipsoid(center,scene.ellipsoid);
    camera.cancelFlight();
    if(pivot && (dx || dy) && controller.enableTranslate && controller.enableRotate) {
      const shifted=camera.pickEllipsoid(new C.Cartesian2(center.x+C.Math.clamp(dx,-120,120),center.y+C.Math.clamp(dy,-120,120)),scene.ellipsoid);
      if(shifted) {
        const destination=C.Cartesian3.add(camera.positionWC,C.Cartesian3.subtract(shifted,pivot,new C.Cartesian3()),new C.Cartesian3());
        const position=C.Cartographic.fromCartesian(destination,scene.ellipsoid);
        position.height=camera.positionCartographic.height;
        camera.setView({destination:scene.ellipsoid.cartographicToCartesian(position),orientation:{heading:camera.heading,pitch:camera.pitch,roll:camera.roll}});
      }
    }
    if(angle && controller.enableRotate) {
      const target=camera.pickEllipsoid(center,scene.ellipsoid);
      if(target) {
        const transform=C.Matrix4.clone(camera.transform);
        camera.lookAtTransform(C.Transforms.eastNorthUpToFixedFrame(target,scene.ellipsoid));
        camera.rotate(C.Cartesian3.UNIT_Z,-C.Math.clamp(angle,-Math.PI/4,Math.PI/4));
        camera.lookAtTransform(transform);
      }
    }
    if(ratio !== 1 && controller.enableZoom) {
      const distance=pivot?C.Cartesian3.distance(camera.positionWC,pivot):camera.positionCartographic.height;
      const amount=distance*(1-1/C.Math.clamp(ratio,0.5,2));
      // Native Safari pinch should respect ground clearance and maximum height.
      const vertical=Math.max(0.1,-Math.sin(camera.pitch));
      const maxIn=Math.max(0,camera.positionCartographic.height-Math.max(25,controller.minimumZoomDistance))/vertical;
      const maxOut=Math.max(0,controller.maximumZoomDistance-camera.positionCartographic.height)/vertical;
      camera.zoomIn(C.Math.clamp(amount,-maxOut,maxIn));
    }
    scene.requestRender();
  }
  const surface=canvas.closest<HTMLElement>(".city-panel") ?? canvas;
  const unbind=bindMapInput(surface,{
    mode,
    accepts:event=>event.target===canvas || event.target instanceof Element && Boolean(event.target.closest(".map-screen-labels,.map-campus-layer")),
    nativeWheel:event=>{
      if(event.target===canvas) return;
      // HTML markers sit over the canvas. Forward native zoom there, once.
      event.preventDefault();event.stopImmediatePropagation();
      canvas.dispatchEvent(new WheelEvent("wheel",{deltaX:event.deltaX,deltaY:event.deltaY,deltaMode:event.deltaMode,clientX:event.clientX,clientY:event.clientY,ctrlKey:event.ctrlKey,metaKey:event.metaKey,shiftKey:event.shiftKey,altKey:event.altKey,cancelable:true}));
    },
    pan:(dx,dy)=>{x+=dx;y+=dy;schedule();},rotate:angle=>{rotation+=angle;schedule();},zoom:ratio=>{scale*=ratio;schedule();},
  });
  return () => {
    unbind();cancelAnimationFrame(frame);
    if(!viewer.isDestroyed()) controller.zoomEventTypes=originalZoom;
  };
}
