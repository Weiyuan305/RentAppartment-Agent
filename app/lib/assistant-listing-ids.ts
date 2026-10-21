/** Shown to the model in the prompt and in tool results. Ids stay available for tool arguments. */
export const listingIdReplyRule = "面向用户的回复禁止出现内部房源编号（例如 manchester-5、london-2、kuala-lumpur-3，或以 m_ 开头的商家编号）以及包含这些编号的链接或路径。只用房源名称。编号只放在工具参数里，不要写进回复。";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace known internal listing ids with the apartment's display name. Longer ids win, so manchester-5 does not consume manchester-50. */
export function scrubListingIds(text: string, listings: readonly {id: string; name: string}[]) {
  const names = new Map<string, string>();
  for (const listing of listings) {
    if (listing.id && listing.name) names.set(listing.id, listing.name);
  }
  let next = text;
  for (const [id, name] of [...names.entries()].sort((a, b) => b[0].length - a[0].length)) {
    next = next.replace(new RegExp(`(?<![A-Za-z0-9_])${escapeRegExp(id)}(?![A-Za-z0-9_])`, "g"), name);
  }
  return next;
}

export function scrubAssistantMessages<T extends {role: string; parts: {type: string; text?: string}[]}>(messages: T[], listings: readonly {id: string; name: string}[]) {
  return messages.map(message => message.role === "assistant"
    ? {...message, parts: message.parts.map(part => part.type === "text" && part.text ? {...part, text: scrubListingIds(part.text, listings)} : part)}
    : message);
}
