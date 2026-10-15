import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createAuth} from "../lib/auth";
import {getDatabase} from "../lib/agent/database-sqlite";
import {oauthErrorMessage} from "../lib/oauth-errors";

const origin="https://atlas.example";
function cookies(response:Response){return response.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ");}

test("Google OAuth: state, callback safety, persistent identity and explicit linking of existing email accounts",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"atlas-google-"));
  process.env.ATLAS_CHAT_DB=join(directory,"auth.sqlite");
  const database=await getDatabase();
  const auth=createAuth(database,{origin,secret:"test-only-secret-at-least-thirty-two-characters",google:{clientId:"fixture.apps.googleusercontent.com",clientSecret:"fixture-secret"}});
  const providers=(await auth.$context).socialProviders;
  assert.ok(Array.isArray(providers));
  const provider=providers.find(provider=>provider.id === "google");
  assert.ok(provider);
  let profile={id:"google-new-student",email:"google-student@example.com",name:"Google Student",emailVerified:true};
  // Only the remote provider exchange is a fixture. The real Better Auth
  // endpoints, state cookies, persistence, linking and sessions run below.
  provider.validateAuthorizationCode=async()=>({accessToken:"fixture-access-token",scopes:["openid","email","profile"]});
  provider.getUserInfo=async()=>{
    const {id,...user}=profile;
    return {user,data:{sub:id,email:profile.email,email_verified:profile.emailVerified}};
  };
  provider.accountSubject=({profile})=>(profile as {sub:string}).sub;
  let requestNumber=0;
  const call=(path:string,body?:unknown,cookie="")=>auth.handler(new Request(`${origin}/api/auth/${path}`,{
    method:body ? "POST" : "GET",headers:{"Content-Type":"application/json",Origin:origin,Cookie:cookie,"cf-connecting-ip":`198.51.100.${++requestNumber}`},body:body ? JSON.stringify(body):undefined,
  }));
  const begin=async(link=false,cookie="")=>{
    const response=await call(link ? "link-social" : "sign-in/social",{provider:"google",callbackURL:"/listing/london-2",errorCallbackURL:"/login?next=%2Flisting%2Flondon-2",disableRedirect:true},cookie);
    assert.equal(response.status,200,await response.clone().text());
    const url=new URL((await response.json() as {url:string}).url);
    assert.equal(url.origin,"https://accounts.google.com");
    assert.equal(url.searchParams.get("redirect_uri"),`${origin}/api/auth/callback/google`);
    assert.equal(url.searchParams.get("access_type"),"online");
    assert.ok(url.searchParams.get("state"));
    assert.ok(url.searchParams.get("code_challenge"));
    assert.deepEqual(new Set(url.searchParams.get("scope")?.split(" ")),new Set(["openid","email","profile"]));
    return {state:url.searchParams.get("state")!,cookie:[cookie,cookies(response)].filter(Boolean).join("; ")};
  };
  const complete=(flow:{state:string;cookie:string},extra="code=fixture-code")=>call(`callback/google?state=${encodeURIComponent(flow.state)}&${extra}`,undefined,flow.cookie);
  try {
    assert.equal((await call("sign-in/social",{provider:"google",callbackURL:"https://attacker.example"})).status,403);
    assert.equal((await call("sign-in/social",{provider:"google",callbackURL:"/",errorCallbackURL:"https://attacker.example"})).status,403);
    assert.match((await call("callback/google?code=fixture-code")).headers.get("location") ?? "",/error=state_not_found/);
    const cancelled=await complete(await begin(),"error=access_denied");
    assert.match(cancelled.headers.get("location") ?? "",/error=access_denied/);
    const flow=await begin();
    const signedIn=await complete(flow);
    assert.equal(signedIn.status,302);
    assert.equal(signedIn.headers.get("location"),"/listing/london-2");
    const session=await (await call("get-session",undefined,cookies(signedIn))).json() as {user:{id:string;email:string}};
    assert.equal(session.user.email,profile.email);
    assert.match(signedIn.headers.get("set-cookie") ?? "",/HttpOnly/);
    assert.match((await complete(flow)).headers.get("location") ?? "",/error=/,"OAuth state cannot be replayed");
    const returning=await complete(await begin());
    const returningSession=await (await call("get-session",undefined,cookies(returning))).json() as {user:{id:string}};
    assert.equal(returningSession.user.id,session.user.id);
    const stored=await database.first<{accessToken:string}>("SELECT accessToken FROM auth_account WHERE userId=?",[session.user.id]);
    assert.notEqual(stored?.accessToken,"fixture-access-token");
    await call("sign-out",{},cookies(returning));
    assert.equal(await (await call("get-session",undefined,cookies(returning))).json(),null);

    profile={...profile,id:"google-existing-student",email:"existing@example.com"};
    const signup=await call("sign-up/email",{email:profile.email,name:"Existing Student",password:"test-password-123"});
    assert.equal(signup.status,200);
    const original=(await signup.json() as {user:{id:string}}).user;
    const blocked=await complete(await begin());
    assert.match(blocked.headers.get("location") ?? "",/error=account_not_linked/);
    assert.equal((await database.first<{count:number}>("SELECT count(*) AS count FROM auth_user WHERE email=?",[profile.email]))?.count,1);
    const linked=await complete(await begin(true,cookies(signup)));
    assert.equal(linked.headers.get("location"),"/listing/london-2");
    const account=await database.first<{userId:string}>("SELECT userId FROM auth_account WHERE providerId='google' AND accountId=?",[profile.id]);
    assert.equal(account?.userId,original.id,"linking preserves the user ID used by saved homes and history");
    const linkedSignIn=await complete(await begin());
    const linkedSession=await (await call("get-session",undefined,cookies(linkedSignIn))).json() as {user:{id:string}};
    assert.equal(linkedSession.user.id,original.id);
    assert.equal((await call("sign-in/email",{email:profile.email,password:"test-password-123"})).status,200,"password login still works after Google linking");
    profile={...profile,id:"google-other-email",email:"other@example.com"};
    assert.match((await complete(await begin(true,cookies(signup)))).headers.get("location") ?? "",/error=email_does_not_match/);
    assert.equal((await call("link-social",{provider:"google",callbackURL:"/"})).status,401);
  } finally {database.close();rmSync(directory,{recursive:true,force:true});}
});

test("OAuth errors are safe localized messages rather than arbitrary provider text",()=>{
  assert.match(oauthErrorMessage("account_not_linked"),/原密码/);
  assert.match(oauthErrorMessage("access_denied"),/取消/);
  assert.equal(oauthErrorMessage(),"");
  assert.doesNotMatch(oauthErrorMessage("<script>bad</script>"),/<script>/);
});
