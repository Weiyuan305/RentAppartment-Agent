import {test} from "node:test";
import assert from "node:assert/strict";
import {availableMapRect} from "../lib/map-viewport";
import {markerOverlaps} from "../lib/map-marker-density";
import {emptyDecisionNote,readNotebook} from "../lib/student/notebook";

test("route viewport stays inside the actual canvas and clear of desktop panels",()=>{
  const obstacles=[{left:20,top:22,right:326,bottom:568},{left:950,top:22,right:1260,bottom:568},{left:350,top:76,right:710,bottom:120},{left:350,top:460,right:810,bottom:536},{left:890,top:150,right:930,bottom:350}];
  const rect=availableMapRect(1280,590,obstacles);
  assert.ok(rect.left>=0&&rect.top>=0&&rect.right<=1280&&rect.bottom<=590);
  assert.ok(rect.right-rect.left>200&&rect.bottom-rect.top>150);
  assert.ok(obstacles.every(block=>!markerOverlaps(rect,block,0)));
});
test("overlapping overlays never manufacture a rectangle below the mobile screen",()=>{
  const blocks=[{left:12,top:12,right:306,bottom:430},{left:12,top:360,right:350,bottom:530},{left:0,top:560,right:360,bottom:620}];
  const rect=availableMapRect(360,620,blocks,8);
  assert.ok(rect.right<=360&&rect.bottom<=620);
  assert.ok(blocks.every(block=>!markerOverlaps(rect,block,0)));
  const covered=availableMapRect(360,620,[{left:0,top:0,right:360,bottom:620}]);
  assert.equal(covered.right-covered.left,0);
});
test("notes keep independent homes, ignore unknown ids and reject malformed observations",()=>{
  const note={...emptyDecisionNote(),stage:"confirming",notes:"询问账单与噪声 · <script>literal text</script>",viewedOn:"2026-10-14"};
  const raw=JSON.stringify({"london-1":note,"london-2":{...note,checks:{...note.checks,noise:"verified-by-platform"}},"not-a-home":note,"sydney-1":{...emptyDecisionNote(),notes:"Second city"}});
  const restored=readNotebook(raw);
  assert.equal(restored["london-1"].notes,note.notes);
  assert.equal(restored["sydney-1"].notes,"Second city");
  assert.deepEqual(Object.keys(restored).sort(),["london-1","sydney-1"]);
  for(const value of ["{","null","[]",JSON.stringify({"london-1":{...note,viewedOn:"2026-02-30"}}),JSON.stringify({"london-1":{...note,notes:"x".repeat(1501)}})])assert.deepEqual(readNotebook(value),{});
});
