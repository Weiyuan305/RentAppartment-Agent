import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync,rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createAuth } from "../lib/auth";
import { getDatabase } from "../lib/agent/database-sqlite";
import { createLibraryHandler } from "../lib/personal-library/server";
import { emptyLibrary,mergeLibrary,readFavorites,type LibraryData } from "../lib/personal-library/model";
import { emptyDecisionNote } from "../lib/student/notebook";

const origin="https://library.example";
const cookies=(r:Response)=>r.headers.getSetCookie().map(s=>s.split(";")[0]).join("; ");
test("authenticated library: two devices, isolation, import, conflict and sign-out",async t=>{
  const folder=mkdtempSync(join(tmpdir(),"atlas-library-"));
  process.env.ATLAS_CHAT_DB=join(folder,"library.sqlite");
  const database=await getDatabase(),auth=createAuth(database,{origin,secret:"test-only-library-secret-longer-than-thirty-two-characters"});
  const handler=createLibraryHandler({database:async()=>database,user:async request=>(await auth.api.getSession({headers:request.headers}))?.user??null});
  const authCall=(path:string,body:unknown,cookie="")=>auth.handler(new Request(`${origin}/api/auth/${path}`,{method:"POST",headers:{origin,cookie,"Content-Type":"application/json"},body:JSON.stringify(body)}));
  const call=(cookie="",body?:unknown,requestOrigin=origin)=>handler(new Request(`${origin}/api/library`,{method:body===undefined?"GET":"POST",headers:{cookie,origin:requestOrigin,"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)}));
  try {
    const alice=await authCall("sign-up/email",{name:"Alice",email:"alice@example.test",password:"test-only-alice-password"});assert.equal(alice.status,200);
    const a=await alice.json() as {user:{id:string}},cookieA=cookies(alice);
    const second=await authCall("sign-in/email",{email:"alice@example.test",password:"test-only-alice-password"});assert.equal(second.status,200);const cookieB=cookies(second);
    const bob=await authCall("sign-up/email",{name:"Bob",email:"bob@example.test",password:"test-only-bob-password"});assert.equal(bob.status,200);const b=await bob.json() as {user:{id:string}},cookieOther=cookies(bob);
    const note={...emptyDecisionNote(),notes:"Check noise at night. 核对费用 <script>literal text</script>"};
    const favorite={kind:"favorite",accountId:a.user.id,listingId:"london-2",saved:true,version:0};
    await t.test("guest, forged owner, cross-site and malformed input are rejected",async()=>{
      assert.equal((await call()).status,401);assert.equal((await call("",favorite)).status,401);
      assert.equal((await call(cookieOther,favorite)).status,409);
      assert.equal((await call(cookieA,favorite,"https://attacker.example")).status,403);
      assert.equal((await call(cookieA,{...favorite,userId:b.user.id})).status,400);
      assert.equal((await call(cookieA,{...favorite,listingId:"unknown"})).status,400);
      assert.equal((await call(cookieA,{kind:"note",accountId:a.user.id,listingId:"london-2",version:0,note:{...note,notes:"x".repeat(1501)}})).status,400);
      assert.equal((await call(cookieA,{...favorite,extra:"x".repeat(33000)})).status,413);
    });
    await t.test("a second login reads saved favorites and notes; another account sees none",async()=>{
      assert.equal((await call(cookieA,favorite)).status,200);
      assert.equal((await call(cookieA,{kind:"note",accountId:a.user.id,listingId:"london-2",version:0,note})).status,200);
      const response=await call(cookieB);assert.equal(response.headers.get("Cache-Control"),"private, no-store");
      const restored=await response.json() as LibraryData;assert.equal(restored.favorites["london-2"].saved,true);assert.deepEqual(restored.notes["london-2"].note,note);
      const other=await (await call(cookieOther)).json() as LibraryData;assert.deepEqual(other.favorites,{});assert.deepEqual(other.notes,{});
    });
    await t.test("removing a favorite reaches another device and import cannot resurrect or overwrite",async()=>{
      assert.equal((await call(cookieB,{...favorite,saved:false,version:1})).status,200);
      const incoming={kind:"import",accountId:a.user.id,favorites:["london-2","sydney-1"],notes:[{listingId:"london-2",note:{...note,notes:"old guest draft"}},{listingId:"sydney-1",note}]};
      assert.equal((await call(cookieA,incoming)).status,200);assert.equal((await call(cookieA,incoming)).status,200);
      const restored=await (await call(cookieA)).json() as LibraryData;assert.equal(restored.favorites["london-2"].saved,false);assert.equal(restored.favorites["sydney-1"].saved,true);
      assert.equal(restored.notes["london-2"].note.notes,note.notes);assert.equal(restored.notes["sydney-1"].version,1);
    });
    await t.test("concurrent stale edits return conflict rather than silently replacing a note",async()=>{
      const command={kind:"note",accountId:a.user.id,listingId:"london-2",version:1,note};
      const results=await Promise.all([call(cookieA,{...command,note:{...note,notes:"Device A"}}),call(cookieB,{...command,note:{...note,notes:"Device B"}})]);
      assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
      const conflict=await results.find(r=>r.status===409)!.json() as LibraryData & {code:string};assert.equal(conflict.code,"VERSION_CONFLICT");assert.equal(conflict.notes["london-2"].version,2);
    });
    await t.test("signed-out credentials cannot read or write, second device remains signed in",async()=>{
      assert.equal((await authCall("sign-out",{},cookieA)).status,200);
      assert.equal((await call(cookieA)).status,401);assert.equal((await call(cookieA,favorite)).status,401);
      assert.equal((await call(cookieB)).status,200);
    });
  } finally {database.close();rmSync(folder,{recursive:true,force:true});}
});

test("client refresh cannot roll back newer notes or removed favorites; guest ids are validated",()=>{
  const note=emptyDecisionNote();
  const current={favorites:{"london-2":{saved:false,version:3}},notes:{"london-2":{note:{...note,notes:"new"},version:2}}};
  const old={favorites:{"london-2":{saved:true,version:2}},notes:{"london-2":{note,version:1}}};
  assert.deepEqual(mergeLibrary(current,old),current);assert.deepEqual(mergeLibrary(emptyLibrary(),current),current);
  assert.deepEqual(readFavorites('["london-2","london-2","unknown",3]'),["london-2"]);
  assert.deepEqual(readFavorites("{broken"),[]);
});
