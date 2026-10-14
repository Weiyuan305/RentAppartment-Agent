import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyFilters } from "../lib/assistant";
import { emptyStudentPlan } from "../lib/student/state";
import { emptyMapSelection } from "../lib/agent/contract";
import { removeRentalFilter, sameRentalFilters, type FilterSnapshot } from "../lib/rental-filter-actions";
import { readBrowseSnapshot, browseReturnUrl, type BrowseSnapshot } from "../lib/browse-memory";

const filters: FilterSnapshot={filters:{...emptyFilters,budget:400,bills:true,walkMinutes:30},housing:{moveIn:"2027-01-01",leaseMonths:6,availableOnly:true},onlySaved:true};
test("individual removal preserves all other criteria and undo expires after another edit",()=>{
  const next=removeRentalFilter(filters,"budget");
  assert.equal(next.filters.budget,null);assert.equal(next.filters.walkMinutes,30);
  assert.equal(next.filters.bills,true);assert.deepEqual(next.housing,filters.housing);assert.equal(next.onlySaved,true);
  assert.equal(filters.filters.budget,400,"the undo snapshot must remain immutable");
  assert.equal(sameRentalFilters(next,{...next,filters:{...next.filters,bills:false}}),false);
  assert.equal(sameRentalFilters(next,{...next,filters:{...next.filters}}),true);
  assert.deepEqual(removeRentalFilter(filters,"leaseMonths").housing,{...filters.housing,leaseMonths:null});
  assert.equal(removeRentalFilter(filters,"onlySaved").onlySaved,false);
  assert.deepEqual(removeRentalFilter(filters,"all"),{filters:emptyFilters,housing:emptyStudentPlan().housing,onlySaved:false});
});
const snapshot:BrowseSnapshot={version:1,token:"11111111-1111-4111-8111-111111111111",url:"/?city=london&listing=london-2",state:{cityId:"london",listingId:"london-2",filters:filters.filters,student:emptyStudentPlan(),map:emptyMapSelection()},onlySaved:false,sort:"price",mobileTab:"list",expandedIds:["london-2"],scroll:{anchorId:"london-2",offset:85,top:742},camera:{longitude:-0.14,latitude:51.52,height:1350,heading:1.2,pitch:-0.8,roll:0}};
test("detail return restores only the matching entry and keeps filters, scroll and camera",()=>{
  const restored=readBrowseSnapshot(JSON.stringify(snapshot),snapshot.token,"london");
  assert.deepEqual(restored,snapshot);
  const betweenCards={...snapshot,scroll:{...snapshot.scroll,offset:-12}};
  assert.equal(readBrowseSnapshot(JSON.stringify(betweenCards),snapshot.token,"london")?.scroll.offset,-12,"preserve the gap above the next card too");
  assert.equal(readBrowseSnapshot(JSON.stringify(snapshot),"wrong-entry","london"),null);
  assert.equal(readBrowseSnapshot(JSON.stringify(snapshot),null,"london"),null,"ordinary deep links ignore stale browsing state");
  assert.equal(readBrowseSnapshot(JSON.stringify(snapshot),snapshot.token,"sydney"),null);
  assert.equal(new URL(browseReturnUrl(snapshot),"https://test.invalid").searchParams.get("restore"),snapshot.token);
});
test("malformed storage, invalid coordinates and external return URLs are ignored",()=>{
  for(const value of [null,"{","{}",JSON.stringify({...snapshot,url:"https://example.com/?city=london"}),JSON.stringify({...snapshot,url:"//example.com/?city=london"}),JSON.stringify({...snapshot,url:"/login?city=london"}),JSON.stringify({...snapshot,camera:{...snapshot.camera,latitude:100}}),JSON.stringify({...snapshot,state:{...snapshot.state,listingId:"sydney-1"}})]){
    assert.equal(readBrowseSnapshot(value,snapshot.token,"london"),null);
  }
});
