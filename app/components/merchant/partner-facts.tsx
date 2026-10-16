"use client";
/* eslint-disable @next/next/no-img-element -- Published partner floor plans. */
import type { Listing } from "@/lib/rental-data";
import { getCity } from "@/lib/rental-data";
import { useLocale } from "../locale-provider";
import "./workbench.css";
export function PartnerFacts({ listing }: { listing: Listing }) {
  const { locale } = useLocale(),
    w = (zh: string, en: string) => (locale === "zh" ? zh : en),
    m = listing.merchant;
  if (!m) return null;
  const currency = getCity(listing.cityId).currency;
  return (
    <section className="mw-partner-details">
      <h2>{w("商家提供的房源资料", "Information from the host")}</h2>
      <p>
        {locale === "en" && m.descriptionEn ? m.descriptionEn : m.description}
      </p>
      <dl>
        <dt>{w("发布商家", "Listed by")}</dt>
        <dd>{m.name}</dd>
        <dt>{w("地址", "Address")}</dt>
        <dd>{m.address}</dd>
        <dt>{w("原始租金报价", "Original rent quote")}</dt>
        <dd>
          {currency}
          {m.price} / {m.period === "week" ? w("周", "week") : w("月", "month")}
        </dd>
        <dt>{w("可租数量 / 日期", "Availability / Dates")}</dt>
        <dd>
          {m.quantity} · {m.availableFrom} – {m.availableUntil}
        </dd>
        <dt>{w("租期", "Lease")}</dt>
        <dd>
          {m.minMonths}–{m.maxMonths} {w("个月", "months")}
        </dd>
        <dt>{w("押金 / 一次性费用", "Deposit / One-off fees")}</dt>
        <dd>
          {currency}
          {m.deposit} / {currency}
          {m.fees}
        </dd>
        <dt>{w("账单范围", "Bills")}</dt>
        <dd>{m.billDetails}</dd>
        <dt>{w("担保要求", "Guarantor")}</dt>
        <dd>{m.guarantor}</dd>
        <dt>{w("付款与取消条款", "Payment & cancellation")}</dt>
        <dd>
          {m.paymentTerms}
          <br />
          {m.cancellation}
        </dd>
        <dt>{w("入住资格", "Eligibility")}</dt>
        <dd>
          {m.studentOnly
            ? w("仅限学生", "Students only")
            : w("不限学生身份", "Non-students welcome")}
        </dd>
        <dt>{w("资料更新", "Last published")}</dt>
        <dd>{m.updatedAt.slice(0, 10)}</dd>
      </dl>
      <p>
        {w(
          "资料经平台审核后发布，未实地核验。可租数量可能变化，付款前请确认合同、收费和房源真实性。本站目前支持咨询与预约，不收取租金或押金。",
          "Published after platform review, without an on-site inspection. Availability can change. Confirm the property, terms and fees before paying. This site supports enquiries and viewing requests; it does not collect rent or deposits.",
        )}
      </p>
      {!!m.floorPlans?.length && (
        <section>
          <h3>{w("户型图", "Floor plans")}</h3>
          <div className="mw-preview-photos">
            {m.floorPlans.map((url, index) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                <img
                  src={url}
                  alt={`${w("户型图", "Floor plan")} ${index + 1}`}
                />
              </a>
            ))}
          </div>
        </section>
      )}
      <a className="mw-primary" href={`/inquiries?listing=${listing.id}`}>
        {w("咨询 / 预约看房 / 举报", "Enquire / Request viewing / Report")} →
      </a>
    </section>
  );
}
