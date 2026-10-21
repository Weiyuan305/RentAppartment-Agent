import test, {after} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {translator} from "../lib/i18n";
import {isViewingContact, viewingContactError, viewingFieldError, viewingRequestBodySchema, viewingRequestReady} from "../lib/viewing-contact";

const directory = mkdtempSync(join(tmpdir(), "atlas-viewing-"));
process.env.ATLAS_CHAT_DB = join(directory, "viewing.sqlite");
const {POST} = await import("../app/api/viewing-requests/route");
const {getDatabase} = await import("../lib/agent/database-sqlite");

after(async () => {
  (await getDatabase()).close();
  rmSync(directory, {recursive: true, force: true});
});

test("contact accepts email or phone and rejects wechat ids and fragments", () => {
  assert.equal(isViewingContact("ada@example.com"), true);
  assert.equal(isViewingContact("  +44 161 496 0123  "), true);
  assert.equal(isViewingContact("(0161) 496-0123"), true);
  assert.equal(isViewingContact("1234567"), true);
  assert.equal(isViewingContact("abc"), false);
  assert.equal(isViewingContact("x"), false);
  assert.equal(isViewingContact("wxid_student"), false);
  assert.equal(isViewingContact("123456"), false);
  assert.equal(isViewingContact("12.34.567"), false);
  assert.equal(viewingRequestReady({name: " Ada ", contact: "ada@example.com", preferredTime: "Saturday"}), true);
  assert.equal(viewingRequestReady({name: "Ada", contact: "abc", preferredTime: "Saturday"}), false);
  assert.equal(viewingRequestReady({name: " ", contact: "+44 7700 900123", preferredTime: "Saturday"}), false);
  const zh = translator("zh"), en = translator("en");
  assert.equal(zh(viewingFieldError("name", "", true)), "请填写姓名。");
  assert.equal(en(viewingFieldError("contact", "x", true)), "Enter a valid email or phone number.");
  assert.equal(en(viewingFieldError("preferredTime", "", true)), "Enter a preferred time.");
  assert.equal(viewingFieldError("contact", "ada@example.com", true), "");
  assert.equal(viewingRequestBodySchema.safeParse({listingId: "manchester-5", cityId: "manchester", name: "Ada", contact: "abc", preferredTime: "Saturday"}).success, false);
});

test("the viewing request API rejects abc and x and stores a real email or phone", async () => {
  const origin = "http://localhost:5174";
  const call = (contact: string, extra: Record<string, unknown> = {}) => POST(new Request(`${origin}/api/viewing-requests`, {
    method: "POST",
    headers: {origin, "Content-Type": "application/json"},
    body: JSON.stringify({listingId: "manchester-5", cityId: "manchester", name: "Ada", contact, preferredTime: "Saturday morning", message: "demo", ...extra}),
  }));
  for (const contact of ["abc", "x", "wxid_student", "12345"]) {
    const response = await call(contact);
    assert.equal(response.status, 400);
    assert.equal((await response.json() as {error: string}).error, viewingContactError);
  }
  const email = await call("ada@example.com");
  assert.equal(email.status, 200);
  assert.equal((await email.json() as {demo: boolean}).demo, true);
  const phone = await call("+44 161 496 0123");
  assert.equal(phone.status, 200);
  const missing = await call("ada@example.com", {name: " "});
  assert.equal(missing.status, 400);
  assert.equal((await missing.json() as {error: string}).error, "请求参数无效。");
});
