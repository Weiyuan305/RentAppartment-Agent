export function agentConfig() {
  const values = {ATLAS_AI_BASE_URL: process.env.ATLAS_AI_BASE_URL?.trim(), ATLAS_AI_MODEL: process.env.ATLAS_AI_MODEL?.trim(), ATLAS_AI_API_KEY: process.env.ATLAS_AI_API_KEY?.trim()};
  const missing = Object.entries(values).filter(([,v]) => !v).map(([k]) => k);
  let validURL = false;
  try {const url = new URL(values.ATLAS_AI_BASE_URL || ""); validURL = ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash;} catch {}
  if (!validURL && values.ATLAS_AI_BASE_URL) missing.push("ATLAS_AI_BASE_URL（无效网址）");
  return {configured: missing.length === 0, missing, baseURL: values.ATLAS_AI_BASE_URL, model: values.ATLAS_AI_MODEL, apiKey: values.ATLAS_AI_API_KEY};
}
