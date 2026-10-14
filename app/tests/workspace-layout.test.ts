import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultWorkspaceLayout as initial, workspaceTransition as next, readWorkspaceLayout, visibleWorkspacePanels, panelWidths, serializeWorkspaceLayout } from "../lib/workspace-layout";
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
  for(const raw of [null,"{","null",'{}','{"version":3,"list":false,"chat":true}','{"version":1,"list":"false","chat":true}']) assert.deepEqual(readWorkspaceLayout(raw),initial);
  assert.deepEqual(readWorkspaceLayout('{"version":1,"list":false,"chat":true,"focus":true}'),{...initial,list:false,chat:true,focus:false});
});
test("density uses stable priority, suppresses overlaps, and never drops selected/focused markers", () => {
  const box={left:10,top:10,right:40,bottom:40};
  const candidates=[{...box,id:"ordinary",priority:0},{...box,id:"selected",priority:1,pinned:true},{...box,id:"focus",priority:2,pinned:true},{left:100,top:100,right:130,bottom:130,id:"library",priority:3}];
  assert.deepEqual([...chooseMapMarkers(candidates,3)].sort(),["focus","library","selected"]);
  assert.deepEqual([...chooseMapMarkers(candidates,0)].sort(),["focus","selected"]);
  assert.deepEqual([...chooseMapMarkers(candidates.reverse(),3)].sort(),["focus","library","selected"]);
});

test("layout v2 persists width and filter disclosure, migrates v1, resets and clamps", () => {
  const preferred={...initial,listWidth:480,chatWidth:440,preferencesCollapsed:true,focus:true};
  assert.deepEqual(readWorkspaceLayout(serializeWorkspaceLayout(preferred)),{...preferred,focus:false});
  assert.equal(readWorkspaceLayout('{"version":2,"list":true,"chat":true,"listWidth":-1,"chatWidth":"500"}').listWidth,280);
  assert.equal(readWorkspaceLayout('{"version":2,"list":true,"chat":true,"listWidth":-1,"chatWidth":"500"}').chatWidth,null);
  assert.deepEqual(next(preferred,"reset"),initial);
  assert.equal(next(initial,{panel:"chat",width:1000}).chatWidth,480);
  assert.equal(next(preferred,{panel:"list",width:null}).listWidth,null);
  for (const viewport of [1101,1280,1440,1920]) {
    const widths=panelWidths(viewport,preferred);
    assert.ok(widths.list>=280&&widths.chat>=280&&widths.list<=480&&widths.chat<=480);
    assert.ok(widths.list+widths.chat<=widths.budget);
  }
  assert.equal(panelWidths(1920,preferred).list,480,"a smaller viewport must not discard the saved preference");
});
