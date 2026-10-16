import test from "node:test";
import assert from "node:assert/strict";
import { boundedFetch, recoverStoredReply, TransportTimeout } from "../lib/agent/chat-connection";
import { initialRentalState, type RentalSession } from "../lib/agent/contract";

const session = (messages: RentalSession["messages"] = []): RentalSession => ({id:"session",version:2,state:initialRentalState("london"),messages});
const user = {id:"question",role:"user" as const,parts:[{type:"text" as const,text:"Hello"}]};
const answer = {id:"answer",role:"assistant" as const,parts:[{type:"text" as const,text:"Hello!",state:"done" as const}]};

test("a request with no response headers is bounded even if fetch ignores abort", async () => {
  await assert.rejects(boundedFetch("https://test.invalid", {}, {fetcher:()=>new Promise(()=>{}),headersMs:20,totalMs:100}), TransportTimeout);
});
test("a response whose body stops arriving cannot keep chat busy forever", async () => {
  const response=await boundedFetch("https://test.invalid", {}, {fetcher:async()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode("partial"));}})),idleMs:20,totalMs:100});
  await assert.rejects(response.text(), TransportTimeout);
});
test("heartbeats cannot extend the total request deadline", async () => {
  let interval:ReturnType<typeof setInterval>;
  const response=await boundedFetch("https://test.invalid", {}, {fetcher:async()=>new Response(new ReadableStream({start(c){interval=setInterval(()=>c.enqueue(new TextEncoder().encode(": waiting\n\n")),5);},cancel(){clearInterval(interval);}})),idleMs:30,totalMs:35});
  await assert.rejects(response.text(),TransportTimeout);
});
test("slow but progressing streams retain status, headers and every byte", async () => {
  const response=await boundedFetch("https://test.invalid", {}, {fetcher:async()=>new Response("complete",{status:201,headers:{"x-test":"yes"}}),idleMs:20,totalMs:100});
  assert.equal(response.status,201);assert.equal(response.headers.get("x-test"),"yes");assert.equal(await response.text(),"complete");
});
test("explicit Stop interrupts a hung request and is never treated as a timeout", async () => {
  const controller=new AbortController();
  const task=boundedFetch("https://test.invalid", {signal:controller.signal}, {fetcher:()=>new Promise(()=>{}),headersMs:500});
  controller.abort();await assert.rejects(task,{name:"AbortError"});
});
test("network recovery waits for the server lease and restores one stored answer without replaying tools", async () => {
  let loads=0;
  const result=await recoverStoredReply({messageId:user.id,sessionId:"session",signal:new AbortController().signal,timeoutMs:200,intervalMs:1,load:async()=>{loads++;if(loads===1)throw new TypeError("offline");return loads===2?{...session(),processingUntil:Date.now()+1000}:session([user,answer]);}});
  assert.equal(result.kind,"complete");assert.equal(loads,3);assert.equal(result.session.messages.filter(m=>m.id===user.id).length,1);
});
test("persistent disconnection exits within its recovery budget", async () => {
  await assert.rejects(recoverStoredReply({messageId:user.id,sessionId:"session",signal:new AbortController().signal,timeoutMs:25,intervalMs:1,load:()=>new Promise(()=>{})}),TransportTimeout);
});
test("Stop during automatic synchronization cancels its pending read", async () => {
  const controller = new AbortController();
  const recovery = recoverStoredReply({messageId:user.id,sessionId:"session",signal:controller.signal,load:()=>new Promise(()=>{})});
  controller.abort(); await assert.rejects(recovery,{name:"AbortError"});
});
test("server timeout is retained and a newer turn is never overwritten",async()=>{
  const run=(s:RentalSession)=>recoverStoredReply({messageId:user.id,sessionId:"session",signal:new AbortController().signal,load:async()=>s});
  assert.equal((await run(session([user,{...answer,metadata:{replyStatus:"timeout"},parts:[]}]))).kind,"incomplete");
  assert.equal((await run(session([user,answer,{...user,id:"another"}]))).kind,"superseded");
  assert.equal((await run(session())).kind,"missing");
});
