import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "远居 Campus Atlas · 留学生找房",
  description: "探索伦敦、悉尼、新加坡、吉隆坡和香港，找到你的留学新家。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
