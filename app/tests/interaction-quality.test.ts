import {test} from "node:test";
import assert from "node:assert/strict";
import {placeMapLabel,markerOverlaps,type MarkerBounds} from "../lib/map-marker-density";
import {mapTravelDuration} from "../lib/map-motion";
import {chatActivity} from "../lib/agent/activity";
import type {RentalMessage} from "../lib/agent/contract";

test("selected nearby store never covers the selected price in the reported mobile geometry",()=>{
  const price={left:112,top:423,right:161,bottom:456},poi={left:130,top:412,right:261,bottom:445};
  const blocks=[price,{left:321,top:301,right:365,bottom:565},{left:27,top:696,right:364,bottom:764}];
  const offset=placeMapLabel(poi,{left:22,top:192,right:368,bottom:822},blocks);
  assert.ok(offset);
  const moved={left:poi.left+offset.x,right:poi.right+offset.x,top:poi.top+offset.y,bottom:poi.bottom+offset.y};
  assert.ok(blocks.every(block=>!markerOverlaps(moved,block,6)));
  assert.deepEqual(placeMapLabel(poi,{left:22,top:192,right:368,bottom:822},blocks,offset),offset);
});
test("selected labels respect panel occlusion and report no space instead of overlapping",()=>{
  for(const width of [390,768,1280]){
    const frame={left:8,top:8,right:width-8,bottom:620};
    const boxes:MarkerBounds[]=[{left:0,top:0,right:100,bottom:620},{left:width-80,top:0,right:width,bottom:620}];
    const label={left:10,top:260,right:65,bottom:293},offset=placeMapLabel(label,frame,boxes);
    assert.ok(offset);
    assert.ok(boxes.every(box=>!markerOverlaps({left:label.left+offset.x,right:label.right+offset.x,top:label.top+offset.y,bottom:label.bottom+offset.y},box,6)));
    assert.equal(placeMapLabel(label,frame,[frame]),null);
  }
});
test("map travel scales with distance and reduced-motion makes every trip instant",()=>{
  const distances=[50,600,3000,100000];
  const durations=distances.map(value=>mapTravelDuration(value));
  assert.ok(durations.every(value=>value>0 && value<1));
  assert.deepEqual(durations,[...durations].sort());
  for(const value of distances)assert.equal(mapTravelDuration(value,true),0);
});
test("activity follows tool execution, not stale history or a simulated timer",()=>{
  const message=(state:string)=>[{id:"reply",role:"assistant",parts:[{type:"tool-planWalkingRoute",toolCallId:"route",state,input:{destination:"campus"}}]}] as RentalMessage[];
  assert.equal(chatActivity(message("input-available"),true,"zh"),"正在理解你的需求…");
  assert.equal(chatActivity(message("input-streaming"),false,"zh"),"正在准备查询…");
  assert.equal(chatActivity(message("input-available"),false,"en"),"Calculating the walking route…");
  assert.equal(chatActivity(message("output-available"),false,"zh"),"正在整理回复…");
  assert.equal(chatActivity(message("output-error"),false,"en"),"Preparing the answer…");
});
