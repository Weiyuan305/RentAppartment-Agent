"use client";
import { useState, type FormEvent } from "react";
import { useLocale } from "@/components/locale-provider";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Listing } from "@/lib/rental-data";

export function ViewingRequestSheet({listing, open, onOpenChange}: {listing: Listing | null; open: boolean; onOpenChange: (open: boolean) => void}) {
  const {t} = useLocale();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  function reset() {
    setName(""); setContact(""); setPreferredTime(""); setMessage(""); setNotice(""); setSaved(false); setBusy(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!listing || busy) return;
    if (!name.trim() || !contact.trim() || !preferredTime.trim()) { setNotice(t("请填写姓名、联系方式和方便的时间。")); return; }
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/viewing-requests", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        credentials: "same-origin",
        body: JSON.stringify({listingId: listing.id, cityId: listing.cityId, name: name.trim(), contact: contact.trim(), preferredTime: preferredTime.trim(), message: message.trim()}),
      });
      if (!response.ok) throw new Error("save failed");
      setSaved(true);
    } catch { setNotice(t("演示请求暂时没能记下，请再试一次。")); }
    finally { setBusy(false); }
  }

  return <Sheet open={open} onOpenChange={next => { if (!next) reset(); onOpenChange(next); }}>
    <SheetContent side="bottom" className="viewing-sheet">
      <SheetHeader>
        <SheetTitle>{t("预约看房或咨询")}</SheetTitle>
        <SheetDescription>{listing ? `${listing.name} · ` : ""}{t("这是演示请求。记录只留在本站，不会发送给中介、房东或经纪人。")}</SheetDescription>
      </SheetHeader>
      {saved ? <p className="viewing-saved" role="status">{t("已记录这条演示请求。没有发送给中介、房东或经纪人。")}</p> : <form className="viewing-form" onSubmit={event => void submit(event)}>
        <label>{t("姓名")}<input name="name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} maxLength={80}/></label>
        <label>{t("联系方式")}<input name="contact" autoComplete="email" value={contact} onChange={event => setContact(event.target.value)} maxLength={120}/></label>
        <label>{t("方便看房的时间")}<input name="preferredTime" value={preferredTime} onChange={event => setPreferredTime(event.target.value)} maxLength={120}/></label>
        <label>{t("想问的问题（可选）")}<textarea name="message" value={message} onChange={event => setMessage(event.target.value)} maxLength={500}/></label>
        {notice && <p className="viewing-notice" role="status">{notice}</p>}
        <button type="submit" className="listing-viewing-button" disabled={busy || !listing}>{t("提交演示请求")}</button>
      </form>}
    </SheetContent>
  </Sheet>;
}
