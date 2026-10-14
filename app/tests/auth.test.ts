import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAuth } from "../lib/auth";
import { getDatabase } from "../lib/agent/database-sqlite";
import { identity } from "../lib/agent/http";
import { sessionForCity } from "../lib/agent/store";
import { safeReturnPath, translator, displayCity } from "../lib/i18n";
import { cities } from "../lib/rental-data";

const origin = "https://atlas.example";
function cookies(response:Response) {return response.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ");}

test("auth: real registration, password verification, persistent session, origin checks, account isolation and sign-out", async()=>{
  const directory = mkdtempSync(join(tmpdir(),"atlas-auth-"));
  process.env.ATLAS_CHAT_DB = join(directory,"auth.sqlite");
  process.env.ATLAS_AUTH_SECRET = "test-only-secret-which-is-longer-than-thirty-two-characters";
  const database = await getDatabase();
  const auth = createAuth(database,{origin,secret:process.env.ATLAS_AUTH_SECRET});
  async function call(path:string,body?:unknown,cookie="",ip="198.51.100.7",requestOrigin=origin) {
    return auth.handler(new Request(`${origin}/api/auth/${path}`,{method:body ? "POST" : "GET",headers:{"Content-Type":"application/json",Origin:requestOrigin,Cookie:cookie,"cf-connecting-ip":ip},body:body ? JSON.stringify(body):undefined}));
  }
  try {
    const signup = await call("sign-up/email",{email:"student@example.com",name:"Student",password:"testing-pass-123"});
    assert.equal(signup.status,200,JSON.stringify(await signup.clone().json()));
    const signupBody = await signup.json() as {user:{id:string;emailVerified:boolean}};
    assert.equal(signupBody.user.emailVerified,false);
    const cookie = cookies(signup);
    assert.match(cookie,/__Secure-atlas-auth\.session_token=/);
    assert.match(signup.headers.get("set-cookie") ?? "",/HttpOnly/);
    const stored = await database.first<{password:string}>("SELECT password FROM auth_account WHERE userId=?",[signupBody.user.id]);
    assert.ok(stored?.password && stored.password !== "testing-pass-123");
    assert.equal((await call("get-session",undefined,cookie)).status,200);
    assert.equal((await call("sign-in/email",{email:"student@example.com",password:"wrong-pass"})).status,401);
    const signin = await call("sign-in/email",{email:"student@example.com",password:"testing-pass-123"});
    assert.equal(signin.status,200);
    const loginCookie = cookies(signin);
    const accountIdentity = await identity(new Request(origin,{headers:{Cookie:loginCookie}}));
    const guestIdentity = await identity(new Request(origin),true);
    assert.notEqual(accountIdentity.owner,guestIdentity.owner);
    assert.equal((await identity(new Request(origin,{headers:{Cookie:cookie}}))).owner,accountIdentity.owner);
    const accountChat = await sessionForCity(accountIdentity.owner,"london");
    const guestChat = await sessionForCity(guestIdentity.owner,"london");
    assert.notEqual(accountChat.id,guestChat.id);
    assert.equal((await call("sign-in/email",{email:"student@example.com",password:"testing-pass-123"},"","198.51.100.8","https://attacker.example")).status,403);
    assert.equal((await call("sign-out",{},loginCookie)).status,200);
    assert.equal(await (await call("get-session",undefined,loginCookie)).json(),null);
    const duplicate = await call("sign-up/email",{email:"student@example.com",name:"Student",password:"testing-pass-456"},"","198.51.100.9");
    assert.notEqual(duplicate.status,200);
    // A fresh auth instance per request mirrors the Worker: throttling must persist in D1/SQLite.
    for(let attempt=0;attempt<7;attempt++){
      const fresh = createAuth(database,{origin,secret:process.env.ATLAS_AUTH_SECRET!});
      const response = await fresh.handler(new Request(`${origin}/api/auth/sign-in/email`,{method:"POST",headers:{"Content-Type":"application/json",Origin:origin,"cf-connecting-ip":"198.51.100.20"},body:JSON.stringify({email:"student@example.com",password:"wrong-pass"})}));
      assert.equal(response.status,attempt < 6 ? 401 : 429);
    }
  } finally {database.close();rmSync(directory,{recursive:true,force:true});}
});

test("locale: coherent English, immutable canonical data, interpolation and safe return destinations",()=>{
  const en = translator("en"),zh=translator("zh");
  assert.equal(en("在{city}，找到新家",{city:"London"}),"Find your new home in London");
  assert.equal(zh("在{city}，找到新家",{city:"伦敦"}),"在伦敦，找到新家");
  assert.equal(en("独卫单间"),"En-suite room");
  assert.equal(displayCity(cities[0],"en").period,"week");
  assert.equal(cities[0].period,"周");
  for(const unsafe of ["https://attacker.example","//attacker.example","/\\attacker.example","/login?next=/login"])assert.equal(safeReturnPath(unsafe),"/?city=london");
  assert.equal(safeReturnPath("/?city=sydney&listing=sydney-2"),"/?city=sydney&listing=sydney-2");
});
