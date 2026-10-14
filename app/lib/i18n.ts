import { createInstance } from "i18next";
import messages from "./locales/en.json";
import type { City } from "./rental-data";

export type Locale = "zh" | "en";
export type Translate = (key: string, values?: Record<string, string | number>) => string;
export function validLocale(value: unknown): value is Locale {return value === "zh" || value === "en";}

// Fixed translators are safe across concurrent SSR requests: no global language mutation.
const dictionary = createInstance();
void dictionary.init({lng:"zh", fallbackLng:false, initAsync:false, keySeparator:false, nsSeparator:false,
  resources:{en:{translation:messages}, zh:{translation:{}}},
  interpolation:{escapeValue:false, prefix:"{", suffix:"}"},
});
export function translator(locale: Locale): Translate {
  return (key, values) => String(dictionary.getFixedT(locale)(key, {
    ...Object.fromEntries(Object.entries(values ?? {}).map(([name, value]) => [name, typeof value === "string" ? dictionary.getFixedT(locale)(value) : value])),
    defaultValue:key,
  }));
}
const englishCities: Record<City["id"], Pick<City, "country" | "university" | "campus" | "neighborhoods">> = {
  london:{country:"United Kingdom",university:"University College London",campus:"Bloomsbury campus",neighborhoods:[]},
  sydney:{country:"Australia",university:"University of Sydney",campus:"Camperdown / Darlington",neighborhoods:[]},
  singapore:{country:"Singapore",university:"National University of Singapore",campus:"Kent Ridge campus",neighborhoods:[]},
  "kuala-lumpur":{country:"Malaysia",university:"Universiti Malaya",campus:"Main campus",neighborhoods:[]},
  "hong-kong":{country:"Hong Kong",university:"University of Hong Kong",campus:"Pok Fu Lam main campus",neighborhoods:["Sai Ying Pun","Kennedy Town","Shek Tong Tsui","Pok Fu Lam","Sheung Wan","Western District"]},
};
export function displayCity(city: City, locale: Locale) {
  if (locale === "zh") return city;
  const english = englishCities[city.id];
  return {...city,...english,name:city.english,period:city.period === "周" ? "week" : "month",neighborhoods:english.neighborhoods.length ? english.neighborhoods : city.neighborhoods};
}
export function displayArea(area: string, locale: Locale) {
  if (locale === "zh") return area;
  const zh = ["西营盘","坚尼地城","石塘咀","薄扶林","上环","西环"];
  return englishCities["hong-kong"].neighborhoods[zh.indexOf(area)] ?? area;
}
export function displayDistance(meters: number, locale: Locale) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} ${locale === "en" ? "km" : "公里"}` : `${Math.round(meters)} ${locale === "en" ? "m" : "米"}`;
}

export function safeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/?city=london";
  try {const url = new URL(value,"https://atlas.invalid"); return url.origin === "https://atlas.invalid" && !url.pathname.startsWith("/login") ? url.pathname + url.search + url.hash : "/?city=london";} catch {return "/?city=london";}
}
