"use client";
import { viewingFieldError, viewingRequestReady } from "@/lib/viewing-contact";
import type { Listing } from "@/lib/rental-data";
import { priceLabel } from "@/lib/rental-data";
import { compareFacts } from "@/lib/v2/compare-facts";
import { signpostMinutes, signpostPlace } from "@/lib/v2/signpost";
import { useState, type FormEvent } from "react";
import { Signpost } from "./signpost";

export function V2Detail({ listing, buildingId, locale, onClose, onBook, onCompare }: {
  listing: Listing;
  buildingId: string | null;
  locale: "zh" | "en";
  onClose: () => void;
  onBook: () => void;
  onCompare: () => void;
}) {
  const zh = locale === "zh";
  const facts = compareFacts([listing.id], buildingId, [listing])[0];
  return <section className="v2-sheet" role="dialog" aria-modal="true" aria-labelledby="v2-detail-title">
    <div className="v2-sheet-panel">
      <header className="v2-sheet-head">
        <button type="button" onClick={onClose}>{zh ? "关闭" : "Close"}</button>
        <p>{listing.area}</p>
      </header>
      <img src={listing.photos[0]} alt="" />
      <div className="v2-sheet-body">
        <h2 id="v2-detail-title">{listing.name}</h2>
        <p className="v2-price">{priceLabel(listing)}<span> / {zh ? "周" : "wk"}</span></p>
        <Signpost display minutes={signpostMinutes(listing, buildingId)} place={signpostPlace(buildingId, locale)} />
        <ul className="v2-facts">
          <li>{listing.roomType}</li>
          <li>{listing.size}㎡</li>
          <li>{listing.bills ? (zh ? "含水电网" : "Bills included") : (zh ? "水电网另计" : "Bills extra")}</li>
        </ul>
        <h3>{zh ? "合同要点" : "Contract"}</h3>
        <dl className="v2-contract">
          {facts?.contract.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
        </dl>
        {facts?.risks.length ? <ul className="v2-risks">{facts.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul> : null}
      </div>
      <div className="v2-book-bar">
        <button type="button" className="v2-secondary" onClick={onCompare}>{zh ? "加入对比" : "Compare"}</button>
        <button type="button" className="v2-primary" onClick={onBook}>{zh ? "预约看房" : "Book a viewing"}</button>
      </div>
    </div>
  </section>;
}

export function V2Booking({ listing, locale, onClose }: { listing: Listing; locale: "zh" | "en"; onClose: () => void }) {
  const zh = locale === "zh";
  const [values, setValues] = useState({ name: "", contact: "", preferredTime: "", message: "" });
  const [show, setShow] = useState(false);
  const [done, setDone] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!viewingRequestReady(values)) { setShow(true); return; }
    setPending(true);
    try {
      const response = await fetch("/api/viewing-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: listing.id, cityId: listing.cityId, ...values }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "failed");
      setDone(zh ? "已记下这次看房。顾问会按你留的联系方式确认。" : "Viewing request saved.");
    } catch {
      setDone(zh ? "这次没有提交成功，可以再试一次。" : "The request did not send. Try again.");
    } finally { setPending(false); }
  }
  return <section className="v2-sheet" role="dialog" aria-modal="true" aria-labelledby="v2-book-title">
    <form className="v2-sheet-panel" onSubmit={submit}>
      <header className="v2-sheet-head"><button type="button" onClick={onClose}>{zh ? "返回" : "Back"}</button><p>{listing.name}</p></header>
      <div className="v2-sheet-body">
        <h2 id="v2-book-title">{zh ? "预约看房" : "Book a viewing"}</h2>
        <label>{zh ? "姓名" : "Name"}<input value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} /></label>
        <p className="v2-error">{viewingFieldError("name", values.name, show)}</p>
        <label>{zh ? "邮箱或电话" : "Email or phone"}<input value={values.contact} onChange={(event) => setValues({ ...values, contact: event.target.value })} /></label>
        <p className="v2-error">{viewingFieldError("contact", values.contact, show)}</p>
        <label>{zh ? "方便的时间" : "A time that works"}<input value={values.preferredTime} onChange={(event) => setValues({ ...values, preferredTime: event.target.value })} /></label>
        <p className="v2-error">{viewingFieldError("preferredTime", values.preferredTime, show)}</p>
        <label>{zh ? "备注" : "Note"}<textarea value={values.message} onChange={(event) => setValues({ ...values, message: event.target.value })} /></label>
        {done ? <p role="status">{done}</p> : null}
      </div>
      <div className="v2-book-bar"><button className="v2-primary" type="submit" disabled={pending}>{zh ? "提交预约" : "Send request"}</button></div>
    </form>
  </section>;
}

export function V2Compare({ ids, listings, buildingId, locale, onClose, onOpen }: {
  ids: string[];
  listings: Listing[];
  buildingId: string | null;
  locale: "zh" | "en";
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const zh = locale === "zh";
  const rows = compareFacts(ids, buildingId, listings);
  return <section className="v2-sheet" role="dialog" aria-modal="true" aria-labelledby="v2-compare-title">
    <div className="v2-sheet-panel v2-compare-panel">
      <header className="v2-sheet-head"><button type="button" onClick={onClose}>{zh ? "关闭" : "Close"}</button><h2 id="v2-compare-title">{zh ? "对比" : "Compare"}</h2></header>
      <div className="v2-compare-grid">
        {rows.map((row) => <article key={row.id}>
          <h3>{row.name}</h3>
          <p>{row.area}</p>
          <dl>
            <div><dt>{zh ? "月合计" : "Monthly total"}</dt><dd>{row.monthly === "unknown" ? "unknown" : `£${row.monthly}`}</dd></div>
            <div><dt>{zh ? "说明" : "Note"}</dt><dd>{row.monthlyNote}</dd></div>
            <div><dt>{zh ? "通勤" : "Commute"}</dt><dd>{row.commute === "unknown" ? "unknown" : `${row.commute} ${zh ? "分钟" : "min"}`}</dd></div>
            <div><dt>{zh ? "押金" : "Deposit"}</dt><dd>{row.deposit === "unknown" ? "unknown" : `£${row.deposit}`}</dd></div>
            {row.contract.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
          </dl>
          <ul className="v2-risks">{row.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul>
          <button type="button" className="v2-primary" onClick={() => onOpen(row.id)}>{zh ? "预约看房" : "Book a viewing"}</button>
        </article>)}
      </div>
    </div>
  </section>;
}
