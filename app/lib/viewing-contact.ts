import { z } from "zod";

const email = z.string().email();

/** Email, or a phone made of digits, spaces, +, -, and parentheses with at least 7 digits. */
export function isViewingContact(value: string) {
  const contact = value.trim();
  if (!contact || contact.length > 120) return false;
  if (email.safeParse(contact).success) return true;
  if (!/^[0-9+\-() ]+$/.test(contact)) return false;
  return (contact.match(/\d/g) ?? []).length >= 7;
}

export const viewingContactError = "联系方式须为有效邮箱或电话号码。";

export const viewingRequestBodySchema = z.object({
  listingId: z.string().trim().min(1).max(80),
  cityId: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  contact: z.string().trim().max(120).refine(isViewingContact, {message: viewingContactError}),
  preferredTime: z.string().trim().min(1).max(120),
  message: z.string().trim().max(500).optional().default(""),
});

export function viewingRequestReady(values: {name: string; contact: string; preferredTime: string}) {
  const name = values.name.trim();
  const preferredTime = values.preferredTime.trim();
  return name.length > 0 && name.length <= 80 && preferredTime.length > 0 && preferredTime.length <= 120 && isViewingContact(values.contact);
}

/** Chinese copy keys. Pass them through the locale translator. */
export function viewingFieldError(field: "name" | "contact" | "preferredTime", value: string, show: boolean) {
  if (!show) return "";
  if (field === "contact") return isViewingContact(value) ? "" : "请填写有效的邮箱或电话号码。";
  if (value.trim()) return "";
  return field === "name" ? "请填写姓名。" : "请填写方便看房的时间。";
}
