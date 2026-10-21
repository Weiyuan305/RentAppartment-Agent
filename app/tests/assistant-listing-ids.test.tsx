import test from "node:test";
import assert from "node:assert/strict";
import {renderToStaticMarkup} from "react-dom/server";
import {AssistantMarkdown} from "../components/assistant-markdown";
import {listingIdReplyRule, scrubAssistantMessages, scrubListingIds} from "../lib/assistant-listing-ids";
import {initialRentalState} from "../lib/agent/contract";
import {createRentalTools} from "../lib/agent/tools";

const listings = [
  {id: "manchester-5", name: "Union Rooms"},
  {id: "manchester-50", name: "Other House"},
  {id: "kuala-lumpur-10", name: "Atlas Residence"},
  {id: "m_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee_1234abcd", name: "Partner Loft"},
];

test("rendered replies replace internal listing ids with display names", () => {
  const text = scrubListingIds("Compare manchester-5 with manchester-50, then see /listing/kuala-lumpur-10 and m_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee_1234abcd.", listings);
  assert.equal(text, "Compare Union Rooms with Other House, then see /listing/Atlas Residence and Partner Loft.");
  assert.equal(scrubListingIds("manchester-5.", listings), "Union Rooms.");
  assert.equal(scrubListingIds("xmanchester-5", listings), "xmanchester-5");
  const html = renderToStaticMarkup(<AssistantMarkdown text={scrubListingIds("推荐 **manchester-5**。", listings)}/>);
  assert.equal(html.includes("manchester-5"), false);
  assert.match(html, /Union Rooms/);
  const saved = scrubAssistantMessages([{role: "assistant", parts: [{type: "text", text: "看 manchester-5"}]}, {role: "user", parts: [{type: "text", text: "manchester-5"}]}], listings);
  assert.equal(saved[0].parts[0].text, "看 Union Rooms");
  assert.equal(saved[1].parts[0].text, "manchester-5");
});

test("listing tools tell the model to speak names instead of internal ids", async () => {
  assert.match(listingIdReplyRule, /manchester-5/);
  assert.match(listingIdReplyRule, /房源名称/);
  const runtime = createRentalTools(initialRentalState("manchester"));
  const pending = await runtime.tools.searchListings.execute!({}, {toolCallId: "ids", messages: [], context: {}});
  if (!pending || typeof pending !== "object" || Symbol.asyncIterator in pending) throw new Error("searchListings must return one result");
  assert.equal(pending.replyRule, listingIdReplyRule);
  assert.equal(pending.listings.find(item => item.id === "manchester-5")?.name, "Union Rooms");
  const selected = await runtime.tools.selectListing.execute!({listingId: "manchester-5"}, {toolCallId: "select", messages: [], context: {}});
  if (!selected || typeof selected !== "object" || Symbol.asyncIterator in selected) throw new Error("selectListing must return one result");
  assert.equal(selected.name, "Union Rooms");
  assert.equal(selected.replyRule, listingIdReplyRule);
});
