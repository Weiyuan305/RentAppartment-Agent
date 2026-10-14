"use client";
import { Languages } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLocale } from "./locale-provider";
export function LanguageSwitch() {
  const {locale,setLocale} = useLocale();
  return <div className="language-switch"><Languages size={15} aria-hidden="true"/><ToggleGroup type="single" value={locale} onValueChange={value=>{if(value === "zh" || value === "en")setLocale(value);}} size="sm" aria-label="Language / 语言"><ToggleGroupItem value="zh" aria-label="切换为中文">中文</ToggleGroupItem><ToggleGroupItem value="en" aria-label="Switch to English">EN</ToggleGroupItem></ToggleGroup></div>;
}
