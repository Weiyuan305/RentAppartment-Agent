const url = process.argv[2] || "https://campus-atlas-demo.pages.dev/api/health";
let last = "no attempt";
for (let attempt = 1; attempt <= 6; attempt += 1) {
  try {
    const response = await fetch(url, {redirect: "error", signal: AbortSignal.timeout(30000)});
    const body = await response.json();
    if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
    if (body?.status !== "ok") throw new Error("health status was not ok");
    if (response.headers.get("cache-control") !== "no-store") throw new Error("cache-control was not no-store");
    if (response.headers.get("set-cookie")) throw new Error("health set a cookie");
    console.log(JSON.stringify({url, attempt, status: body.status}));
    process.exit(0);
  } catch (error) {
    last = error instanceof Error ? error.message : String(error);
    console.error(`health attempt ${attempt}: ${last}`);
    if (attempt < 6) await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}
process.exit(1);
