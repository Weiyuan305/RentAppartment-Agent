"use client";
import { useLocale } from "@/components/locale-provider";
import { campusCommuteEstimate } from "@/lib/campus-commute-estimate";
import { listingVerification, type Listing } from "@/lib/rental-data";

export function ListingCommute({listing}: {listing: Listing}) {
  const {t} = useLocale();
  const estimate = campusCommuteEstimate(listing);
  const verification = listingVerification(listing);
  return <div className="listing-commute">
    <p className="listing-commute-line">
      <strong>{t("到大学通勤（估计）")}</strong>
      <span>{t("步行")} {estimate.walk.minutes} {t("分钟")}</span>
      <span>{t("公交")} {estimate.bus.minutes} {t("分钟")}</span>
      <span>{t("骑行")} {estimate.cycle.minutes} {t("分钟")}</span>
      <span>{t("· 非实时导航")}</span>
      <span className={`verify-tag ${verification === "verified" ? "is-verified" : ""}`}>{verification === "verified" ? t("已核验") : t("待核验")}</span>
    </p>
    <p className="listing-commute-note">{estimate.walkBasis === "road-network" ? t("步行按路网估计；骑行和公交由同一段步行距离折算，不是实时班次或骑行路网。") : t("直线距离折算的步行估计；骑行和公交同样只是距离折算。")}</p>
  </div>;
}
