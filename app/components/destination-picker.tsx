"use client";
import { useState } from "react";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLocale } from "@/components/locale-provider";
import { displayCity } from "@/lib/i18n";
import { CountryFlag } from "@/components/country-flag";
import { cities, countries, citiesInCountry, cityPhoto, type CityId, type CountryId } from "@/lib/rental-data";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (city: CityId) => void;
  variant: "editorial" | "spatial";
};
export default function DestinationPicker({open, onOpenChange, onSelect, variant}: Props) {
  const {t, locale} = useLocale();
  const [country, setCountry] = useState<CountryId | null>(null);
  const choices = country ? citiesInCountry(country) : [];
  const w = (zh: string, en: string) => locale === "zh" ? zh : en;
  return <Dialog open={open} onOpenChange={value => {
    if (!value) setCountry(null);
    onOpenChange(value);
  }}>
    <DialogContent closeLabel={w("关闭城市选择", "Close city selection")} className={`destination-dialog concept-destination concept-dialog-${variant} sm:max-w-[720px]`}>
      <DialogTitle>{country ? t("下一站，选择你的城市") : t("你的留学生活，从哪里开始？")}</DialogTitle>
      <DialogDescription>{t("01 选择国家 / 地区")} <span className={country ? "step-active" : ""}>{t("—— 02 选择城市")}</span></DialogDescription>
      {!country ? <div className="destination-grid">
        {countries.map(group => {
          const representative = group.cities[0];
          return <button key={group.id} onClick={() => setCountry(group.id)}>
            <CountryFlag countryId={representative.countryId}/>
            <strong>{displayCity(representative, locale).country}</strong>
            <span className="country-choice-meta"><small>{group.cities.length} {w("座城市", group.cities.length === 1 ? "city" : "cities")}</small><ArrowRight size={17}/></span>
          </button>;
        })}
      </div> : <>
        <button className="back-link" onClick={() => setCountry(null)}><ChevronLeft size={16}/>{t("返回国家 / 地区")}</button>
        <div className={`city-options ${choices.length === 1 ? "single-city" : ""}`} aria-label={w("选择城市", "Choose a city")}>
          {choices.map(city => {
            const view = displayCity(city, locale);
            return <button className="city-choice" key={city.id} aria-label={w(`选择${city.name}`, `Choose ${city.english}`)} onClick={() => {
              setCountry(null);
              onSelect(city.id);
            }}>
              <img src={cityPhoto(city.id)} alt=""/>
              <div>
                <small>{view.country}</small>
                <h3>{view.name}{locale === "zh" && <span>{city.english}</span>}</h3>
                <p>{view.university}</p>
                <span className="city-choice-cta">{t("开始探索")}<ArrowRight size={16}/></span>
              </div>
            </button>;
          })}
        </div>
      </>}
      <p className="dialog-footnote">{w(`${countries.length} 个国家 / 地区 · ${cities.length} 座留学城市`, `${countries.length} countries / regions · ${cities.length} student cities`)}</p>
    </DialogContent>
  </Dialog>;
}
