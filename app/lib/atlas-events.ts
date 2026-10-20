export type AtlasEventName = "viewing_entry_click" | "viewing_request_recorded";

export type AtlasEvent = {
  name: AtlasEventName;
  listingId?: string;
  cityId?: string;
  locale?: "zh" | "en";
  at: string;
};

/** First-party event. Click tracking must not include the visitor's name or contact. */
export function logAtlasEvent(event: Omit<AtlasEvent, "at"> & { at?: string }) {
  const payload: AtlasEvent = {...event, at: event.at ?? new Date().toISOString()};
  console.info("[atlas-event]", JSON.stringify(payload));
  return payload;
}

export function trackAtlasEvent(event: { name: "viewing_entry_click"; listingId: string; cityId: string; locale: "zh" | "en" }) {
  logAtlasEvent(event);
  if (typeof fetch !== "function") return;
  void fetch("/api/events", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    credentials: "same-origin",
    body: JSON.stringify(event),
  }).catch(() => {});
}
