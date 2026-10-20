import type { Locale } from "./i18n";
import { translator } from "./i18n";

const ROOM_TYPES = ["独立 Studio", "独卫单间", "合租单间"] as const;

/** English replies must not keep the Chinese room-type enum or a parenthetical gloss. */
export function englishRoomReply(text: string) {
  let next = text;
  for (const roomType of ROOM_TYPES) {
    const english = translator("en")(roomType);
    next = next.replaceAll(`（${roomType}）`, "").replaceAll(`(${roomType})`, "");
    next = next.replaceAll(roomType, english);
  }
  return next.replace(/\(\s*\)/g, "").replace(/（\s*）/g, "").replace(/[ \t]{2,}/g, " ").replace(/ +([,.;:!?])/g, "$1").trim();
}

export function roomTypeReplyRule() {
  const en = translator("en");
  return `当界面语言是英文时，房型只能使用这些英文说法：${en("独立 Studio")}、${en("独卫单间")}、${en("合租单间")}。不要在英文回复里写出中文房型，也不要在英文房型后面加中文括号注释。调用 searchListings 时 roomType 参数仍使用中文枚举。`;
}

type TextPart = { type: string; text?: string };
export function sanitizeAssistantRoomTypes<T extends { role: string; parts: TextPart[] }>(messages: T[], locale: Locale): T[] {
  if (locale !== "en") return messages;
  return messages.map(message => message.role === "assistant"
    ? {...message, parts: message.parts.map(part => part.type === "text" && part.text ? {...part, text: englishRoomReply(part.text)} : part)}
    : message);
}
