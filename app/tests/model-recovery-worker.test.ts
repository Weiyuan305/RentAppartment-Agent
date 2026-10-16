import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { Miniflare, createFetchMock } from "miniflare";

test("automatic model recovery runs in Workers with real SDK stream parsing", async () => {
  const compiled = await build({stdin: {contents: `
    import {createOpenAI} from '@ai-sdk/openai';
    import {streamText,wrapLanguageModel} from 'ai';
    import {modelRecovery} from './lib/agent/model-recovery';
    export default {async fetch(){
      const events=[];
      const model=wrapLanguageModel({model:createOpenAI({baseURL:'https://fixture.invalid/v1',apiKey:'fixture'}).chat('fixture'),middleware:modelRecovery({onEvent:e=>events.push(e),firstOutputMs:25,retryDelayMs:1})});
      const result=streamText({model,prompt:'Hello',maxRetries:0});
      return Response.json({text:await result.text,events});
    }};`,resolveDir: process.cwd(),loader: "ts"}, bundle: true, conditions: ["workerd", "browser"], write: false, format: "esm", platform: "node", target: "es2022", external: ["node:*", "cloudflare:*"]});
  const mock = createFetchMock(); mock.disableNetConnect();
  const pool = mock.get("https://fixture.invalid");
  const runtime = new Miniflare({modules: true, script: compiled.outputFiles[0].text, compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"], fetchMock: mock, cf: false});
  const chunk = (delta: unknown, reason: string | null) => `data: ${JSON.stringify({id: "fixture", object: "chat.completion.chunk", created: 1, model: "fixture", choices: [{index: 0, delta, finish_reason: reason}]})}\n\n`;
  const body = chunk({content: "Worker recovered."}, null) + chunk({}, "stop") + "data: [DONE]\n\n";
  try {
    for (const scenario of ["503", "timeout"]) {
      if (scenario === "503") pool.intercept({path: "/v1/chat/completions", method: "POST"}).reply(503, {error: {message: "temporary"}});
      else pool.intercept({path: "/v1/chat/completions", method: "POST"}).reply(200, body).delay(100);
      pool.intercept({path: "/v1/chat/completions", method: "POST"}).reply(200, body);
      const response = await runtime.dispatchFetch("http://test/");
      const data = await response.json() as {text: string; events: {phase: string; reason?: string}[]};
      assert.equal(data.text, "Worker recovered.");
      assert.equal(data.events.filter(e => e.phase === "retry").length, 1);
      assert.equal(data.events.find(e => e.phase === "retry")?.reason, scenario === "503" ? "upstream" : "timeout");
    }
    mock.assertNoPendingInterceptors();
  } finally { await runtime.dispose(); await mock.close(); }
});
