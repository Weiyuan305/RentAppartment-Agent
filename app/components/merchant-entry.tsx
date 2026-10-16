"use client";
import { ArrowRight, Store } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useLocale } from "./locale-provider";

export function MerchantEntry({ variant = "header" }: { variant?: "header" | "card" }) {
  const { locale } = useLocale();
  const { data: session, isPending } = authClient.useSession();
  const chinese = locale === "zh";
  const label = variant === "card"
    ? (chinese ? "商家入驻 / 登录" : "List and manage your homes")
    : (chinese ? "商家入口" : "For hosts");
  return <a className={`merchant-entry merchant-entry-${variant}`}
    href={session?.user || isPending ? "/merchant" : "/login?next=%2Fmerchant"}
    aria-label={label}>
    <Store size={18} aria-hidden="true" />
    <span className="merchant-entry-copy"><span className="merchant-entry-label">{label}</span>
      {variant === "card" && <small>{chinese ? "上传房源、管理价格与看房预约" : "Upload listings, set prices and manage viewings"}</small>}
    </span>
    {variant === "header" ? <span className="merchant-entry-short" aria-hidden="true">{chinese ? "商家" : "Hosts"}</span> : <ArrowRight size={17} aria-hidden="true" />}
  </a>;
}
