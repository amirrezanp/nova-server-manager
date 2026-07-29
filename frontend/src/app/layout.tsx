import type { Metadata } from "next";
import "@fontsource-variable/vazirmatn/wght.css";
import "./globals.css";
import { IconProvider } from "@/components/icon-provider";

export const metadata: Metadata = {
  title: "نوا سرور منیجر",
  description: "مرکز فرمان حرفه‌ای سرور و دیپلوی برنامه‌ها",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body><IconProvider>{children}</IconProvider></body>
    </html>
  );
}
