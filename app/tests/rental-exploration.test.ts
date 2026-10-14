import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyFilters} from '../lib/assistant';
import {emptyStudentPlan} from '../lib/student/state';
import {listings} from '../lib/rental-data';
import {matchingHomes,recoverySuggestions} from '../lib/rental-recovery';
import {inMapSearchArea,type MapSearchArea} from '../lib/map-search-area';
import {removeRentalFilter} from '../lib/rental-filter-actions';
import {keepComparisonRow,comparisonDelta} from '../lib/student/comparison-insights';
import {compareListings} from '../lib/student/planner';
import {actionChanges,canUndoAgentAction} from '../lib/agent/action-receipt';
import {initialRentalState} from '../lib/agent/contract';
import {readBrowseSnapshot} from '../lib/browse-memory';
const homes=listings.filter(l=>l.cityId==='london'),plan=emptyStudentPlan();
const value={filters:{...emptyFilters,budget:1,bills:true},housing:plan.housing,onlySaved:false};
test('empty results suggest only verified relaxations, retaining unrelated criteria',()=>{
 const suggestions=recoverySuggestions(homes,value,plan,[]);
 assert.ok(suggestions.length>0);
 for(const suggestion of suggestions){assert.equal(suggestion.count,matchingHomes(homes,suggestion.value,plan,[]).length);assert.ok(suggestion.count>0);}
 assert.deepEqual(suggestions[0].keys,['budget']);assert.equal(suggestions[0].value.filters.bills,true);assert.equal(value.filters.budget,1);
 assert.deepEqual(recoverySuggestions(homes,{...value,filters:emptyFilters},plan,[]),[]);
});
test('conflicting criteria require combined minimal adjustments and never use unverified safety',()=>{
 const input={...value,onlySaved:true,filters:{...value.filters,safety:true}};
 const suggestions=recoverySuggestions(homes,input,plan,[]);
 assert.deepEqual(suggestions[0].keys,['budget','onlySaved']);assert.equal(suggestions[0].value.filters.safety,true);
});
const area:MapSearchArea={id:'11111111-1111-4111-8111-111111111111',polygon:[[0,0],[2,0],[2,2],[0,2]]};
test('map area includes boundary, rejects outside points and handles rotated footprints',()=>{
 assert.ok(inMapSearchArea(1,1,area));assert.ok(inMapSearchArea(0,1,area));assert.equal(inMapSearchArea(3,1,area),false);
 const diamond={...area,polygon:[[0,1],[1,2],[2,1],[1,0]] as [number,number][]};assert.equal(inMapSearchArea(.1,.1,diamond),false);assert.ok(inMapSearchArea(1,1,diamond));
 const dateline={...area,polygon:[[179,-1],[-179,-1],[-179,1],[179,1]] as [number,number][]};assert.ok(inMapSearchArea(180,0,dateline));assert.equal(inMapSearchArea(0,0,dateline),false);
});
test('area participates in recovery and clear-all without altering other filters',()=>{
 const snapshot={...value,filters:emptyFilters,area};const suggestions=recoverySuggestions(homes,snapshot,plan,[]);
 assert.deepEqual(suggestions[0].keys,['area']);assert.equal(suggestions[0].count,homes.length);
 assert.equal(removeRentalFilter(snapshot,'all').area,null);assert.equal(removeRentalFilter(snapshot,'roomType').area,area);
});
test('differences retain unknown values; missing costs never become a saving',()=>{
 assert.equal(keepComparisonRow(['Included','Included'],false,true),false);
 assert.equal(keepComparisonRow(['Unknown','Unknown'],true,true),true);
 assert.equal(keepComparisonRow(['A','B'],false,true),true);
 assert.equal(keepComparisonRow(['A'],false,true),true);
 const rows=compareListings(['london-1','london-2'],plan),delta=comparisonDelta(rows[0],rows[1]);
 assert.equal(delta.monthly,null);assert.equal(delta.oneWayMinutes,null);assert.equal(delta.rent,Math.round((rows[1].cost.items.rent-rows[0].cost.items.rent)*100)/100);
 const full={...plan,expenses:{utilities:10,internet:10,transport:10,other:10,deposit:0,oneOff:0}};
 const known=compareListings(['london-1','london-2'],full);assert.equal(typeof comparisonDelta(known[0],known[1]).monthly,'number');
});
test('receipts describe real diffs in both languages; later manual changes invalidate undo',()=>{
 const before=initialRentalState('london'),after={...before,filters:{...before.filters,walkMinutes:30},map:{...before.map,categories:['convenience' as const]}};
 assert.deepEqual(actionChanges(before,before,'zh',s=>s),[]);
 assert.ok(actionChanges(before,after,'zh',s=>s).includes('步行时长 · 30 分钟'));
 assert.ok(actionChanges(before,after,'en',s=>s).includes('walking limit · 30 min'));
 assert.equal(canUndoAgentAction(3,3),true);assert.equal(canUndoAgentAction(3,4),false);assert.equal(canUndoAgentAction(3,3,true),false);
});
test('detail-return schema retains map search area and rejects malformed coordinates',()=>{
 const snapshot={version:1,token:area.id,url:'/?city=london',state:initialRentalState('london'),onlySaved:false,sort:'price',mobileTab:'map',expandedIds:[],scroll:{anchorId:null,offset:0,top:0},camera:null,area};
 assert.deepEqual(readBrowseSnapshot(JSON.stringify(snapshot),area.id,'london')?.area,area);
 assert.equal(readBrowseSnapshot(JSON.stringify({...snapshot,area:{...area,polygon:[[999,1],[1,2],[2,2],[3,3]]}}),area.id,'london'),null);
});
