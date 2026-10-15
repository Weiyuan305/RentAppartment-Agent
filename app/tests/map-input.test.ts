import {test} from "node:test";
import assert from "node:assert/strict";
import {bindMapInput,createWheelClassifier,readMapInputMode,type MapInputMode} from "../lib/map-input";

const wheel=(values:Partial<WheelEvent>={})=>({deltaMode:0,deltaX:0,deltaY:100,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,timeStamp:1000,...values});
test("fine two-axis scroll pans; a trackpad burst stays pan through acceleration",()=>{
  const classify=createWheelClassifier();
  assert.equal(classify(wheel({deltaY:8}),"auto"),"pan");
  assert.equal(classify(wheel({deltaY:100,timeStamp:1040}),"auto"),"pan");
  assert.equal(classify(wheel({deltaY:100,timeStamp:2000}),"auto"),"native");
  assert.equal(classify(wheel({deltaX:65,timeStamp:3000}),"auto"),"pan");
  assert.equal(classify(wheel({deltaY:65.5,timeStamp:4000}),"auto"),"pan");
});
test("mouse wheel, pinch, touch and existing modified controls stay independent",()=>{
  const classify=createWheelClassifier();
  for(const deltaMode of [1,2])assert.equal(classify(wheel({deltaMode,deltaY:3}),"auto"),"native");
  for(const mode of ["auto","mouse","trackpad"] as const) {
    assert.equal(classify(wheel({ctrlKey:true,deltaY:-12}),mode),"native");
    assert.equal(classify(wheel({shiftKey:true,deltaX:12}),mode),"rotate");
    assert.equal(classify(wheel({altKey:true}),mode),"native");
  }
  assert.equal(classify(wheel({deltaY:100}),"trackpad"),"pan");
  assert.equal(classify(wheel({deltaY:0.5}),"mouse"),"native");
  assert.equal(readMapInputMode("invalid"),"auto");
});

function fixture() {
  const view=new EventTarget(),doc=Object.assign(new EventTarget(),{defaultView:view});
  const canvas=Object.assign(new EventTarget(),{ownerDocument:doc,clientHeight:600});
  const moves:Array<[string,...number[]]>=[];let mode:MapInputMode="auto";
  const remove=bindMapInput(canvas as unknown as HTMLElement,{mode:()=>mode,pan:(x,y)=>moves.push(["pan",x,y]),rotate:r=>moves.push(["rotate",r]),zoom:s=>moves.push(["zoom",s])});
  function send(type:string,properties:Record<string,unknown>={},target:EventTarget=canvas) {
    const event=new Event(type,{cancelable:true});
    for(const [key,value] of Object.entries(properties))Object.defineProperty(event,key,{value});
    target.dispatchEvent(event);return event;
  }
  return {canvas,doc,view,moves,remove,send,setMode:(value:MapInputMode)=>{mode=value;}};
}
test("wheel deltas preserve both pan axes; Shift rotates; override changes immediately",()=>{
  const f=fixture();
  assert.ok(f.send("wheel",wheel({deltaX:12,deltaY:-18})).defaultPrevented);
  assert.deepEqual(f.moves,[["pan",12,-18]]);
  f.send("wheel",wheel({shiftKey:true,deltaX:10,deltaY:5}));
  assert.deepEqual(f.moves.at(-1),["rotate",0.04]);
  f.setMode("mouse");assert.equal(f.send("wheel",wheel({deltaY:2})).defaultPrevented,false);
  f.setMode("trackpad");f.send("wheel",wheel({deltaMode:1,deltaY:3}));
  assert.deepEqual(f.moves.at(-1),["pan",0,48]);f.remove();
});
test("native twist uses incremental rotation and scale, consumes duplicate Ctrl-wheel",()=>{
  const f=fixture();
  f.send("gesturestart",{rotation:0,scale:1,timeStamp:1000});
  f.send("gesturechange",{rotation:20,scale:1.2,timeStamp:1020});
  f.send("gesturechange",{rotation:30,scale:1.5,timeStamp:1040});
  assert.equal(f.moves.length,4);
  assert.ok(Math.abs(f.moves[0][1]-Math.PI/9)<1e-10);
  assert.ok(Math.abs(f.moves[2][1]-Math.PI/18)<1e-10);
  assert.deepEqual(f.moves[3],["zoom",1.25]);
  assert.ok(f.send("wheel",wheel({ctrlKey:true,deltaY:-10,timeStamp:1050})).defaultPrevented);
  f.send("gestureend",{timeStamp:1060});
  assert.ok(f.send("wheel",wheel({ctrlKey:true,timeStamp:1070})).defaultPrevented);
  assert.equal(f.send("wheel",wheel({ctrlKey:true,timeStamp:1200})).defaultPrevented,false);
  f.remove();
});
test("touchscreen pinch remains Cesium-owned; blur and cleanup release gesture state",()=>{
  const f=fixture();
  f.send("pointerdown",{pointerType:"touch",pointerId:1});
  assert.equal(f.send("gesturestart",{rotation:0,scale:1}).defaultPrevented,false);
  f.send("gesturechange",{rotation:30,scale:2});assert.equal(f.moves.length,0);
  f.send("pointercancel",{pointerId:1},f.doc);
  assert.ok(f.send("gesturestart",{rotation:0,scale:1}).defaultPrevented);
  f.send("blur",{},f.view);
  assert.equal(f.send("wheel",wheel({ctrlKey:true})).defaultPrevented,false);
  f.remove();f.send("wheel",wheel({deltaX:12}));assert.equal(f.moves.length,0);
});

test("UI targets are not consumed; native marker zoom delegates once and cleans up",()=>{
  const doc=Object.assign(new EventTarget(),{defaultView:new EventTarget()});
  const surface=Object.assign(new EventTarget(),{ownerDocument:doc,clientHeight:600});
  let allowed=false,pan=0,native=0;
  const remove=bindMapInput(surface as unknown as HTMLElement,{mode:()=>"auto",accepts:()=>allowed,nativeWheel:()=>{native++;},pan:()=>{pan++;},rotate:()=>{},zoom:()=>{}});
  const dispatch=(props:Record<string,unknown>)=>{const event=new Event("wheel",{cancelable:true});for(const [key,value] of Object.entries(props))Object.defineProperty(event,key,{value});surface.dispatchEvent(event);return event;};
  assert.equal(dispatch(wheel({deltaX:12})).defaultPrevented,false);
  assert.equal(pan,0);assert.equal(native,0);
  allowed=true;dispatch(wheel({ctrlKey:true}));assert.equal(native,1);
  dispatch(wheel({deltaX:12}));assert.equal(pan,1);
  remove();dispatch(wheel({ctrlKey:true}));assert.equal(native,1);
});
