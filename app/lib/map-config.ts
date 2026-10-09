export type MapProvider = "cesium-ion" | "google-maps";
type MapEnvironment = {
  VITE_MAP_PROVIDER?: string;
  VITE_CESIUM_ION_ACCESS_TOKEN?: string;
  VITE_GOOGLE_MAPS_API_KEY?: string;
};

/** Select exactly one provider. Missing credentials never trigger a paid-provider fallback. */
export function resolveMapConfig(env: MapEnvironment) {
  const requested = env.VITE_MAP_PROVIDER?.trim() || "cesium-ion";
  const validProvider = requested === "cesium-ion" || requested === "google-maps";
  const provider: MapProvider = requested === "google-maps" ? "google-maps" : "cesium-ion";
  const credential = (provider === "cesium-ion"
    ? env.VITE_CESIUM_ION_ACCESS_TOKEN
    : env.VITE_GOOGLE_MAPS_API_KEY)?.trim() ?? "";
  const isPlaceholder = /^(?:你的|your[_ -]|replace[_ -]|<)/i.test(credential);
  return { provider, credential, configured: validProvider && !!credential && !isPlaceholder, validProvider };
}
