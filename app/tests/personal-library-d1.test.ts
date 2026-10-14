import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync,readFileSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { d1Database } from "../lib/agent/database-d1";
import { createLibraryHandler } from "../lib/personal-library/server";
import type { LibraryData } from "../lib/personal-library/model";
import { emptyDecisionNote } from "../lib/student/notebook";

test("real D1: account library persists across Worker restart and enforces revisions",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"atlas-library-d1-"));
  const create=()=>new Miniflare({modules:true,script:"export default {fetch(){return new Response('ok')}}",compatibilityDate:"2026-05-15",d1Databases:{ATLAS_DB:"library-test"},d1Persist:directory,cf:false});
  let runtime=create(),binding=await runtime.getD1Database("ATLAS_DB");
  try {
    for(const file of ["0001_rental.sql","0002_auth.sql","0003_personal_library.sql"]){const sql=readFileSync(`migrations/${file}`,"utf8");await binding.batch(sql.replace(/--[^\n]*/g, "").split(";").filter(s=>s.trim()).map(s=>binding.prepare(s)));}
    for(const id of ["alice","bob"])await binding.prepare("INSERT INTO auth_user (id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,0,0,0)").bind(id,id,`${id}@example.test`).run();
    const handle=createLibraryHandler({database:async()=>d1Database(binding as unknown as D1Database),user:async request=>({id:request.headers.get("x-test-user")??"alice"})});
    const call=(body?:unknown,user="alice")=>handle(new Request("https://library.example/api/library",{method:body?"POST":"GET",headers:{Origin:"https://library.example","Content-Type":"application/json","x-test-user":user},body:body?JSON.stringify(body):undefined}));
    const command={kind:"note",accountId:"alice",listingId:"london-2",note:{...emptyDecisionNote(),notes:"D1 persistent note"},version:0};
    assert.equal((await call(command)).status,200);
    assert.equal((await call({kind:"favorite",accountId:"alice",listingId:"london-2",saved:true,version:0})).status,200);
    const competing=await Promise.all([call({...command,version:1,note:{...command.note,notes:"A"}}),call({...command,version:1,note:{...command.note,notes:"B"}})]);
    assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);
    await runtime.dispose();runtime=create();binding=await runtime.getD1Database("ATLAS_DB");
    const restored=await (await call()).json() as LibraryData;assert.equal(restored.notes["london-2"].version,2);assert.equal(restored.favorites["london-2"].saved,true);
    const isolated=await (await call(undefined,"bob")).json() as LibraryData;assert.deepEqual(isolated.notes,{});assert.deepEqual(isolated.favorites,{});
  } finally {await runtime.dispose();rmSync(directory,{recursive:true,force:true});}
});
