"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translator, validLocale, type Locale, type Translate } from "@/lib/i18n";

const LocaleContext = createContext<{locale:Locale;t:Translate;setLocale:(locale:Locale)=>void} | null>(null);
export function LocaleProvider({children,initialLocale="zh"}:{children:React.ReactNode;initialLocale?:Locale}) {
  const [locale,setLanguage] = useState<Locale>(initialLocale);
  function setLocale(next:Locale) {
    setLanguage(next);
    try {localStorage.setItem("atlas-locale",next);} catch {}
    document.cookie = `atlas_locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    document.documentElement.lang = next === "en" ? "en" : "zh-CN";
    const url = new URL(location.href);
    if(url.searchParams.has("lang")) {url.searchParams.delete("lang"); history.replaceState(history.state,"",url.pathname + url.search + url.hash);}
  }
  useEffect(() => {
    const query = new URLSearchParams(location.search).get("lang");
    let saved: string | null = null;
    try {saved = localStorage.getItem("atlas-locale");} catch {}
    const cookie = document.cookie.match(/(?:^|; )atlas_locale=(zh|en)(?:;|$)/)?.[1];
    const next = validLocale(query) ? query : validLocale(saved) ? saved : validLocale(cookie) ? cookie : "zh";
    // Hydrate a browser preference after the deterministic SSR render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocale(next);
    function sync(event:StorageEvent) {if (event.key === "atlas-locale" && validLocale(event.newValue)) setLocale(event.newValue);}
    window.addEventListener("storage",sync); return () => window.removeEventListener("storage",sync);
  },[]);
  useEffect(() => {document.title = locale === "en" ? "Campus Atlas · Student homes abroad" : "远居 Campus Atlas · 留学生找房";},[locale]);
  const t = useMemo(()=>translator(locale),[locale]);
  return <LocaleContext.Provider value={{locale,t,setLocale}}>{children}</LocaleContext.Provider>;
}
export function useLocale() {const value = useContext(LocaleContext); if (!value) throw new Error("LocaleProvider is missing"); return value;}
