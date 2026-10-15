export type MapInputMode = "auto" | "trackpad" | "mouse";
export const MAP_INPUT_KEY = "atlas.map-input.v1";
export function readMapInputMode(value: string | null): MapInputMode {
  return value === "trackpad" || value === "mouse" ? value : "auto";
}

type WheelInput = Pick<WheelEvent, "deltaMode" | "deltaX" | "deltaY" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "timeStamp">;
/** WheelEvent exposes no reliable device ID. Keep an explicit device override. */
export function createWheelClassifier() {
  let lastTrackpad = -Infinity;
  return (event: WheelInput, mode: MapInputMode): "native" | "pan" | "rotate" => {
    if (event.ctrlKey || event.metaKey || event.altKey) return "native";
    if (event.shiftKey) return "rotate";
    if (mode !== "auto") return mode === "trackpad" ? "pan" : "native";
    if (event.deltaMode !== 0) return "native";
    const fine = event.deltaX !== 0 || Math.abs(event.deltaY) < 40 || !Number.isInteger(event.deltaY);
    if (fine) lastTrackpad = event.timeStamp;
    // Keep the same interpretation during an accelerated trackpad scroll burst.
    return fine || event.timeStamp - lastTrackpad < 180 ? "pan" : "native";
  };
}

type NativeGesture = Event & {rotation: number; scale: number};
export type MapInputActions = {
  mode: () => MapInputMode;
  accepts?: (event: Event) => boolean;
  nativeWheel?: (event: WheelEvent) => void;
  pan: (x: number, y: number) => void;
  rotate: (radians: number) => void;
  zoom: (ratio: number) => void;
};

/** The caller limits targets to the canvas and map markers, never UI panels. */
export function bindMapInput(canvas: HTMLElement, actions: MapInputActions) {
  const classify = createWheelClassifier();
  const touches = new Set<number>();
  let gesture: {rotation: number; scale: number} | null = null;
  let suppressWheelUntil = -Infinity;
  const consume = (event: Event) => {event.preventDefault(); event.stopImmediatePropagation();};
  const wheel = (event: WheelEvent) => {
    if (actions.accepts && !actions.accepts(event)) return;
    if (gesture || event.timeStamp < suppressWheelUntil) {consume(event); return;}
    const kind = classify(event, actions.mode());
    if (kind === "native") {actions.nativeWheel?.(event); return;}
    consume(event);
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
    if (kind === "pan") actions.pan(event.deltaX * unit, event.deltaY * unit);
    else actions.rotate((event.deltaX || event.deltaY) * unit * 0.004);
  };
  const pointerDown = (event: PointerEvent) => {if(event.pointerType === "touch") touches.add(event.pointerId);};
  const pointerUp = (event: PointerEvent) => {touches.delete(event.pointerId);};
  const start = (event: Event) => {
    if (actions.accepts && !actions.accepts(event)) return;
    // Real touchscreen gestures remain under Cesium's existing touch controller.
    if (touches.size) return;
    const {rotation,scale} = event as NativeGesture;
    if (!Number.isFinite(rotation) || !Number.isFinite(scale) || scale <= 0) return;
    gesture = {rotation,scale}; consume(event);
  };
  const change = (event: Event) => {
    if (!gesture) return;
    consume(event);
    const {rotation,scale} = event as NativeGesture;
    if (!Number.isFinite(rotation) || !Number.isFinite(scale) || scale <= 0) return;
    const angle = ((rotation - gesture.rotation + 540) % 360 - 180) * Math.PI / 180;
    if (angle) actions.rotate(angle);
    if (scale !== gesture.scale) actions.zoom(scale / gesture.scale);
    gesture = {rotation,scale};
  };
  const end = (event: Event) => {
    if (!gesture) return;
    consume(event); gesture = null; suppressWheelUntil = event.timeStamp + 80;
  };
  const reset = () => {gesture = null; touches.clear(); suppressWheelUntil = -Infinity;};
  const options = {capture:true,passive:false};
  canvas.addEventListener("wheel",wheel,options);
  canvas.addEventListener("gesturestart",start,options);
  canvas.addEventListener("gesturechange",change,options);
  canvas.addEventListener("gestureend",end,options);
  canvas.addEventListener("pointerdown",pointerDown,true);
  canvas.ownerDocument.addEventListener("pointerup",pointerUp,true);
  canvas.ownerDocument.addEventListener("pointercancel",pointerUp,true);
  canvas.ownerDocument.defaultView?.addEventListener("blur",reset);
  return () => {
    canvas.removeEventListener("wheel",wheel,options);
    canvas.removeEventListener("gesturestart",start,options);
    canvas.removeEventListener("gesturechange",change,options);
    canvas.removeEventListener("gestureend",end,options);
    canvas.removeEventListener("pointerdown",pointerDown,{capture:true});
    canvas.ownerDocument.removeEventListener("pointerup",pointerUp,{capture:true});
    canvas.ownerDocument.removeEventListener("pointercancel",pointerUp,{capture:true});
    canvas.ownerDocument.defaultView?.removeEventListener("blur",reset);
    reset();
  };
}
