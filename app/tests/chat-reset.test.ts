import test from "node:test";
import assert from "node:assert/strict";
import {createReplyGate} from "../lib/agent/chat-reset";
import {initialRentalState} from "../lib/agent/contract";
import {emptyFilters} from "../lib/assistant";

test("start over aborts the in-flight reply and ignores late chunks", async () => {
  let send: (value: Uint8Array | null) => void = () => {};
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      send = value => {
        if (value) controller.enqueue(value);
        else controller.close();
      };
    },
  });
  const gate = createReplyGate();
  const run = gate.open();
  const guarded = gate.guard(run, new Response(source));
  const reader = guarded.body!.getReader();
  const decoder = new TextDecoder();
  send(new TextEncoder().encode("hello"));
  const first = await reader.read();
  assert.equal(decoder.decode(first.value), "hello");
  assert.equal(gate.accept(run), true);
  const nextGeneration = gate.reset();
  send(new TextEncoder().encode("manchester-5"));
  const late = await reader.read();
  assert.equal(late.done, true);
  assert.equal(late.value, undefined);
  assert.equal(run.signal.aborted, true);
  assert.equal(gate.accept(run), false);
  assert.notEqual(nextGeneration, run.generation);
  const fresh = initialRentalState("manchester");
  assert.equal(fresh.listingId, "manchester-1");
  assert.deepEqual(fresh.filters, emptyFilters);
  assert.equal(fresh.map.selectedPlaceId, null);
  assert.equal(fresh.map.campusRoute, false);
  const restarted = gate.open();
  assert.equal(gate.accept(restarted), true);
});
