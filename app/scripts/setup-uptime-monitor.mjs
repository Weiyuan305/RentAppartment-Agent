import {createHash} from "node:crypto";
import {mkdirSync, writeFileSync} from "node:fs";

const [email, target] = process.argv.slice(2);
if (!email || !target || new URL(target).protocol !== "https:") {
  throw new Error("Usage: node scripts/setup-uptime-monitor.mjs EMAIL HTTPS_URL");
}
// Official email-only flow. HTTP 200 acknowledges a submission, not activation.
// The owner must confirm the activation email; never retry a successful submit.
const base = "https://api.uptimerobot.com/agentic/agent-monitor";
const challengeURL = new URL(`${base}/challenge`);
challengeURL.searchParams.set("email", email);
challengeURL.searchParams.set("url", target);
const challengeResponse = await fetch(challengeURL, {signal: AbortSignal.timeout(30000)});
if (!challengeResponse.ok) throw new Error(`Challenge failed: HTTP ${challengeResponse.status}`);
const {nonce, timestamp, difficulty, signature} = await challengeResponse.json();
if (typeof nonce !== "string" || typeof signature !== "string" || !Number.isFinite(timestamp) || !Number.isInteger(difficulty) || difficulty < 0 || difficulty > 32) {
  throw new Error("Invalid proof-of-work challenge");
}
const deadline = Date.now() + 45000;
let counter = 0;
for (;;) {
  const hash = createHash("sha256").update(`${nonce}|${counter}`).digest();
  let zeros = 0;
  for (const byte of hash) {
    if (byte === 0) zeros += 8;
    else {zeros += Math.clz32(byte) - 24; break;}
  }
  if (zeros >= difficulty) break;
  if (++counter % 100000 === 0 && Date.now() > deadline) throw new Error("Proof-of-work timed out before submission");
}
const response = await fetch(base, {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({email, url: target, nonce, timestamp, counter, signature}),
  signal: AbortSignal.timeout(30000),
});
const body = await response.json();
if (!response.ok || body.status !== "ok") throw new Error(`Submission failed: HTTP ${response.status}, code ${body.code || "unknown"}`);
const receipt = {
  target,
  submittedAt: new Date().toISOString(),
  httpStatus: response.status,
  activation: "pending-owner-confirmation",
  note: "HTTP 200 cannot prove email delivery or activation; the service also uses 200 for silent rejection.",
};
mkdirSync(".data/monitoring", {recursive: true, mode: 0o700});
writeFileSync(`.data/monitoring/${target.endsWith("/api/health") ? "backend" : "website"}.json`, JSON.stringify(receipt, null, 2) + "\n", {mode: 0o600});
console.log(JSON.stringify(receipt));
