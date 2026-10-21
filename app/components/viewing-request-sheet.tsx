"use client";
import { useState, type FormEvent } from "react";
import { useLocale } from "@/components/locale-provider";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { viewingContactError, viewingFieldError, viewingRequestReady } from "@/lib/viewing-contact";
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
  const [touched, setTouched] = useState({name: false, contact: false, preferredTime: false});
  const ready = viewingRequestReady({name, contact, preferredTime});
  const nameError = t(viewingFieldError("name", name, touched.name));
  const contactError = t(viewingFieldError("contact", contact, touched.contact || contact.trim().length > 0));
  const timeError = t(viewingFieldError("preferredTime", preferredTime, touched.preferredTime));

  function reset() {
    setName(""); setContact(""); setPreferredTime(""); setMessage(""); setNotice(""); setSaved(false); setBusy(false);
    setTouched({name: false, contact: false, preferredTime: false});
  }

  function touch(field: "name" | "contact" | "preferredTime") {
    setTouched(current => ({...current, [field]: true}));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched({name: true, contact: true, preferredTime: true});
    if (!listing || busy || !viewingRequestReady({name, contact, preferredTime})) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/viewing-requests", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        credentials: "same-origin",
        body: JSON.stringify({listingId: listing.id, cityId: listing.cityId, name: name.trim(), contact: contact.trim(), preferredTime: preferredTime.trim(), message: message.trim()}),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as {error?: string} | null;
        if (payload?.error === viewingContactError) {
          setTouched(current => ({...current, contact: true}));
          return;
        }
        throw new Error("save failed");
      }
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
      {saved ? <p className="viewing-saved" role="status">{t("已记录这条演示请求。没有发送给中介、房东或经纪人。")}</p> : <form className="viewing-form" noValidate onSubmit={event => void submit(event)}>
        <label>
          <span className="viewing-label-text">{t("姓名")}<abbr className="viewing-required" title={t("必填")}>*</abbr></span>
          <input name="name" autoComplete="name" required aria-required="true" aria-invalid={nameError ? true : undefined} aria-describedby={nameError ? "viewing-name-error" : undefined} value={name} onChange={event => setName(event.target.value)} onBlur={() => touch("name")} maxLength={80}/>
          {nameError ? <span id="viewing-name-error" className="viewing-field-error" role="alert">{nameError}</span> : null}
        </label>
        <label>
          <span className="viewing-label-text">{t("联系方式")}<abbr className="viewing-required" title={t("必填")}>*</abbr></span>
          <input name="contact" autoComplete="email" required aria-required="true" placeholder={t("邮箱或电话号码")} aria-invalid={contactError ? true : undefined} aria-describedby={contactError ? "viewing-contact-error" : undefined} value={contact} onChange={event => setContact(event.target.value)} onBlur={() => touch("contact")} maxLength={120}/>
          {contactError ? <span id="viewing-contact-error" className="viewing-field-error" role="alert">{contactError}</span> : null}
        </label>
        <label>
          <span className="viewing-label-text">{t("方便看房的时间")}<abbr className="viewing-required" title={t("必填")}>*</abbr></span>
          <input name="preferredTime" required aria-required="true" aria-invalid={timeError ? true : undefined} aria-describedby={timeError ? "viewing-time-error" : undefined} value={preferredTime} onChange={event => setPreferredTime(event.target.value)} onBlur={() => touch("preferredTime")} maxLength={120}/>
          {timeError ? <span id="viewing-time-error" className="viewing-field-error" role="alert">{timeError}</span> : null}
        </label>
        <label>{t("想问的问题（可选）")}<textarea name="message" value={message} onChange={event => setMessage(event.target.value)} maxLength={500}/></label>
        {notice && <p className="viewing-notice" role="status">{notice}</p>}
        <button type="submit" className="listing-viewing-button" disabled={busy || !listing || !ready}>{t("提交演示请求")}</button>
      </form>}
    </SheetContent>
  </Sheet>;
}
