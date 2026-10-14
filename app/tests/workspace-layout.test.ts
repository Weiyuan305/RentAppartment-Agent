import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultWorkspaceLayout as initial, workspaceTransition as next, readWorkspaceLayout, visibleWorkspacePanels } from "../lib/workspace-layout";
import { chooseMapMarkers } from "../lib/map-marker-density";
test("independent panels support all four layouts and focus restores prior mixed state", () => {
  const leftClosed=next(initial,"list");
  assert.deepEqual(visibleWorkspacePanels(leftClosed),{list:false,chat:true});
  const focused=next(leftClosed,"focus");
  assert.deepEqual(visibleWorkspacePanels(focused),{list:false,chat:false});
  assert.deepEqual(next(focused,"focus"),leftClosed);
  assert.deepEqual(visibleWorkspacePanels(next(leftClosed,"chat")),{list:false,chat:false});
  assert.deepEqual(visibleWorkspacePanels(next(initial,"chat")),{list:true,chat:false});
  assert.deepEqual(next(focused,"reset"),initial);
  assert.equal(next(focused,"list").focus,false);
  assert.equal(next(focused,"list").list,true);
});
test("preferences reject malformed/versionless values and never restore transient focus", () => {
  for(const raw of [null,"{","null",'{}','{"version":2,"list":false,"chat":true}','{"version":1,"list":"false","chat":true}']) assert.deepEqual(readWorkspaceLayout(raw),initial);
  assert.deepEqual(readWorkspaceLayout('{"version":1,"list":false,"chat":true,"focus":true}'),{list:false,chat:true,focus:false});
});
test("density uses stable priority, suppresses overlaps, and never drops selected/focused markers", () => {
  const box={left:10,top:10,right:40,bottom:40};
  const candidates=[{...box,id:"ordinary",priority:0},{...box,id:"selected",priority:1,pinned:true},{...box,id:"focus",priority:2,pinned:true},{left:100,top:100,right:130,bottom:130,id:"library",priority:3}];
  assert.deepEqual([...chooseMapMarkers(candidates,3)].sort(),["focus","library","selected"]);
  assert.deepEqual([...chooseMapMarkers(candidates,0)].sort(),["focus","selected"]);
  assert.deepEqual([...chooseMapMarkers(candidates.reverse(),3)].sort(),["focus","library","selected"]);
});
