import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "نوا سرور منیجر",
  description: "مرکز فرمان حرفه‌ای سرور و دیپلوی برنامه‌ها",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

