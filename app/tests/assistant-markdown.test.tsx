import test from "node:test";
import assert from "node:assert/strict";
import {renderToStaticMarkup} from "react-dom/server";
import {AssistantMarkdown} from "../components/assistant-markdown";

test("rental replies render emphasis, lists, tables and CJK punctuation", () => {
  const html = renderToStaticMarkup(<AssistantMarkdown text={
    "从 **Chapter House** 到 **Sainsbury's Local**。\n\n- **步行距离**：119 米\n- **预计时间**：2 分钟\n\n**重要提示（路网估计）：**入口待核验。\n\n| 地点 | 距离 |\n| --- | --- |\n| 便利店 | 119 米 |"
  }/>);
  assert.match(html, /<strong[^>]*>Chapter House<\/strong>/);
  assert.match(html, /<strong[^>]*>重要提示（路网估计）：<\/strong>/);
  assert.match(html, /<ul[\s>]/);
  assert.match(html, /<li[\s>]/);
  assert.match(html, /<table[\s>]/);
  assert.ok(!html.includes("**"));
});

test("an incomplete streamed emphasis is readable before its closing delimiter arrives", () => {
  const html = renderToStaticMarkup(<AssistantMarkdown text="步行约 **2 分钟" streaming/>);
  assert.match(html, /<strong[^>]*>2 分钟<\/strong>/);
  assert.ok(!html.includes("**"));
});

test("model HTML, executable links and remote images do not become active content", () => {
  const html = renderToStaticMarkup(<AssistantMarkdown text={
    "<script>alert('test')</script>\n\n<img src=\"https://example.com/pixel\" onerror=\"alert(1)\">\n\n[危险链接](javascript:alert%281%29)\n\n![图片](https://example.com/track.png)\n\n[设施来源](https://www.openstreetmap.org/)"
  }/>);
  assert.ok(!/<script|<img|\shref=["']javascript:|\sonerror=["']/i.test(html));
  assert.match(html, /href="https:\/\/www\.openstreetmap\.org\/"/);
});
