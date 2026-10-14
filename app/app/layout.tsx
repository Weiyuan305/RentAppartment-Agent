import type { Metadata } from "next";
import { cookies } from "next/headers";
import { validLocale } from "@/lib/i18n";
import "./globals.css";
import "../student-experience.css";
import { PersonalLibraryProvider } from "@/components/personal-library-provider";
import { LocaleProvider } from "@/components/locale-provider";

export async function generateMetadata():Promise<Metadata> {
  const english = (await cookies()).get("atlas_locale")?.value === "en";
  return {
  title: english ? "Campus Atlas · Student homes abroad" : "远居 Campus Atlas · 留学生找房",
  description: english ? "Explore student homes in London, Sydney, Singapore, Kuala Lumpur and Hong Kong." : "探索伦敦、悉尼、新加坡、吉隆坡和香港，找到你的留学新家。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const preferred = (await cookies()).get("atlas_locale")?.value;
  const locale = validLocale(preferred) ? preferred : "zh";
  return (
    <html lang={locale === "en" ? "en" : "zh-CN"}>
      <body className="antialiased"><LocaleProvider initialLocale={locale}><PersonalLibraryProvider>{children}</PersonalLibraryProvider></LocaleProvider></body>
    </html>
  );
}
