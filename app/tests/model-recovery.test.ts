import test from "node:test";
import assert from "node:assert/strict";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, wrapLanguageModel, isStepCount, tool } from "ai";
import { z } from "zod";
import { modelRecovery, type ModelEvent } from "../lib/agent/model-recovery";

const chunk = (delta: unknown, reason: string | null = null) => `data: ${JSON.stringify({id: "qa", object: "chat.completion.chunk", created: 1, model: "fixture", choices: [{index: 0, delta, finish_reason: reason}]})}\n\n`;
const answer = () => new Response(chunk({content: "Recovered answer."}) + chunk({}, "stop") + "data: [DONE]\n\n");
const call = (id: string) => ({tool_calls: [{index: 0, id, type: "function", function: {name: "lookup", arguments: "{}"}}]});
function stalled(body = "") {
  return new Response(new ReadableStream({start(c) {if (body) c.enqueue(new TextEncoder().encode(body));}}));
}
function setup(fetch: typeof globalThis.fetch) {
  const events: ModelEvent[] = [];
  const model = wrapLanguageModel({
    model: createOpenAI({baseURL: "https://fixture.invalid/v1", apiKey: "fixture", fetch}).chat("fixture"),
    middleware: modelRecovery({onEvent: e => events.push(e), firstOutputMs: 25, idleMs: 25, retryDelayMs: 2}),
  });
  const run = (signal?: AbortSignal) => streamText({model, prompt: "Hello", maxRetries: 0, abortSignal: signal, onError: () => {}});
  return {model, events, run};
}

test("stalled headers, empty SSE and partial tool arguments recover before any output escapes", async () => {
  for (const mode of ["headers", "empty-stream", "tool-arguments"] as const) {
    let calls = 0;
    const {run, events} = setup(async (_input, init) => {
      if (++calls > 1) return answer();
      if (mode === "headers") return new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {once: true}));
      return stalled(mode === "tool-arguments" ? chunk({tool_calls: [{index: 0, id: "discarded", type: "function", function: {name: "lookup", arguments: "{"}}]}) : chunk({role: "assistant"}));
    });
    const result = run();
    const parts = [];
    for await (const part of result.fullStream) parts.push(part);
    assert.equal(await result.text, "Recovered answer.");
    assert.equal(calls, 2, mode);
    assert.equal(events.filter(e => e.phase === "retry").length, 1);
    assert.ok(!parts.some(p => "toolCallId" in p && p.toolCallId === "discarded"));
    assert.ok(!parts.some(p => p.type === "error"));
  }
});

test("recovery of a later model step preserves completed tool results and executes once", async () => {
  let calls = 0, executed = 0;
  const {model, events} = setup(async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    calls++;
    if (calls === 1) return new Response(chunk(call("lookup-1")) + chunk({}, "tool_calls") + "data: [DONE]\n\n");
    assert.equal(body.messages.filter((m: {role: string}) => m.role === "user").length, 1);
    assert.ok(body.messages.some((m: {role: string; content: string}) => m.role === "tool" && m.content.includes("map-retained")));
    return calls === 2 ? stalled() : answer();
  });
  const result = streamText({model, prompt: "Find places", maxRetries: 0, stopWhen: isStepCount(3), tools: {
    lookup: tool({inputSchema: z.object({}), execute: async () => {executed++; return "map-retained";}}),
  }});
  await result.consumeStream();
  assert.equal(await result.text, "Recovered answer.");
  assert.equal(executed, 1);
  assert.equal(calls, 3);
  assert.equal(events.find(e => e.phase === "retry")?.step, 2);
});

test("HTTP 503 retries once; invalid credentials do not retry", async () => {
  for (const status of [503, 401]) {
    let calls = 0;
    const {run} = setup(async () => ++calls === 1 ? new Response(JSON.stringify({error: {message: "fixture failure"}}), {status}) : answer());
    const result = run();
    await result.consumeStream();
    assert.equal(calls, status === 503 ? 2 : 1);
    if (status === 503) assert.equal(await result.text, "Recovered answer.");
  }
});

test("explicit Stop cancels the first attempt and never restarts it", async () => {
  let calls = 0;
  const controller = new AbortController();
  const {run, events} = setup(async () => {calls++; setTimeout(() => controller.abort(), 5); return stalled();});
  await run(controller.signal).consumeStream();
  assert.equal(calls, 1);
  assert.equal(events.filter(e => e.phase === "retry").length, 0);
});

test("partial visible text is kept without appending a duplicate answer", async () => {
  let calls = 0;
  const {run, events} = setup(async () => {calls++; return stalled(chunk({content: "Partial answer"}));});
  const parts = [];
  for await (const part of run().fullStream) parts.push(part);
  assert.equal(calls, 1);
  assert.equal(parts.filter(p => p.type === "text-delta").length, 1);
  assert.ok(parts.some(p => p.type === "error"));
  assert.equal(events.at(-1)?.reason, "timeout");
});

test("permanent stall stops after two attempts, with no endless retry", async () => {
  let calls = 0;
  const {run, events} = setup(async () => {calls++; return stalled();});
  await run().consumeStream();
  assert.equal(calls, 2);
  assert.equal(events.at(-1)?.phase, "failed");
  assert.equal(events.at(-1)?.reason, "timeout");
});

test("truncated or empty upstream completion recovers automatically", async () => {
  for (const body of ["", chunk({}, "stop") + "data: [DONE]\n\n"]) {
    let calls = 0;
    const {run} = setup(async () => ++calls === 1 ? new Response(body) : answer());
    const result = run();
    assert.equal(await result.text, "Recovered answer.");
    assert.equal(calls, 2);
  }
});

test("Stop during reconnect backoff prevents the next provider request", async () => {
  const controller = new AbortController();
  let calls = 0;
  const model = wrapLanguageModel({model: createOpenAI({apiKey: "fixture", fetch: async () => {calls++; return new Response('{"error":{"message":"temporary"}}', {status: 503});}}).chat("fixture"), middleware: modelRecovery({retryDelayMs: 20, onEvent: e => {if (e.phase === "retry") controller.abort();}})});
  const result = streamText({model, prompt: "Hello", maxRetries: 0, abortSignal: controller.signal, onError: () => {}});
  await result.consumeStream();
  assert.equal(calls, 1);
});

test("all steps share a maximum of two extra model calls", async () => {
  let calls = 0, executed = 0;
  const {model, events} = setup(async () => {
    calls++;
    if (calls % 2 === 1) return new Response('{"error":{"message":"temporary"}}', {status: 503});
    return new Response(chunk(call(`lookup-${calls}`)) + chunk({}, "tool_calls") + "data: [DONE]\n\n");
  });
  const result = streamText({model, prompt: "Find places", maxRetries: 0, stopWhen: isStepCount(5), onError: () => {}, tools: {
    lookup: tool({inputSchema: z.object({}), execute: async () => {executed++; return "map-retained";}}),
  }});
  await result.consumeStream();
  assert.equal(calls, 5);
  assert.equal(executed, 2);
  assert.equal(events.filter(e => e.phase === "retry").length, 2);
});
