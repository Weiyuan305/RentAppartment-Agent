import type { RentalMessage, ReplyStatus } from "./contract";

export const replyNotices: Record<ReplyStatus, string> = {
  timeout: "回复超时，暂时未能恢复。可以重试这条消息；已完成的地图结果会保留。",
  error: "这次回复未完成。可以重试这条消息；已完成的地图结果会保留。",
  stopped: "回复已停止，可以重试这条消息。",
};

export function retryableMessage(messages: RentalMessage[]) {
  const last = messages.at(-1);
  if (!last || (last.role !== "user" && !last.metadata?.replyStatus && !hasUnfinishedText(last))) return;
  return messages.findLast(message => message.role === "user");
}

export function hasReplyText(message: RentalMessage) {
  return message.parts.some(part => part.type === "text" && part.text.trim());
}

export function hasUnfinishedText(message: RentalMessage) {
  return message.parts.some(part => part.type === "text" && part.state === "streaming");
}
