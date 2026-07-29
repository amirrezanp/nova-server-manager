"use client";

import {
  Activity, ArchiveRestore, Bell, Boxes, ChevronLeft, Command, DatabaseBackup,
  LayoutDashboard, LogOut, Menu, Rocket, Search, Server, Settings, X,
} from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { Logo } from "./ui";
import type { NovaApp, SystemMetrics } from "@/lib/types";

export type RouteName = "dashboard" | "apps" | "app" | "deployments" | "backups" | "activity" | "system" | "settings";

const navigation: Array<{ route: RouteName; label: string; icon: typeof LayoutDashboard }> = [
  { route: "dashboard", label: "نمای کلی", icon: LayoutDashboard },
  { route: "apps", label: "برنامه‌ها", icon: Boxes },
  { route: "deployments", label: "دیپلوی‌ها", icon: Rocket },
  { route: "backups", label: "بکاپ و بازیابی", icon: DatabaseBackup },
  { route: "activity", label: "گزارش فعالیت", icon: Activity },
  { route: "system", label: "وضعیت سرور", icon: Server },
  { route: "settings", label: "تنظیمات", icon: Settings },
];

const titles: Record<RouteName, [string, string]> = {
  dashboard: ["مرکز فرمان", "نمای کلی زیرساخت و سرویس‌ها"],
  apps: ["برنامه‌ها", "مدیریت سرویس‌ها و منابع"],
  app: ["مدیریت برنامه", "تنظیمات، فایل‌ها و عملیات سرویس"],
  deployments: ["دیپلوی‌ها", "تاریخچه و وضعیت انتشارها"],
  backups: ["بکاپ و بازیابی", "نسخه‌های پشتیبان و زمان‌بندی"],
  activity: ["گزارش فعالیت", "رویدادهای مدیریتی سیستم"],
  system: ["وضعیت سرور", "منابع و سلامت زیرساخت"],
  settings: ["تنظیمات", "امنیت و یکپارچه‌سازی‌ها"],
};

export default function Shell({
  route, navigate, user, apps, metrics, onLogout, children,
}: {
  route: RouteName;
  navigate: (route: string) => void;
  user: { username: string };
  apps: NovaApp[];
  metrics: SystemMetrics | null;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [route]);
  const running = apps.filter((app) => app.status === "running").length;
  const [title, subtitle] = titles[route];

  return (
    <div className="shell">
      {open && <button className="sidebar-scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>
        <div className="sidebar__head"><Logo /><button className="sidebar__close" onClick={() => setOpen(false)}><X /></button></div>
        <div className="workspace">
          <span className="workspace__icon"><Command /></span>
          <div><small>فضای کاری</small><strong>{metrics?.hostname || "Nova Server"}</strong></div>
          <ChevronLeft size={15} />
        </div>
        <nav className="nav">
          <span className="nav__label">مدیریت</span>
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = route === item.route || (route === "app" && item.route === "apps");
            return (
              <button key={item.route} className={active ? "active" : ""} onClick={() => navigate(item.route)}>
                <Icon /><span>{item.label}</span>
                {item.route === "apps" && <b>{apps.length.toLocaleString("fa-IR")}</b>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar__footer">
          <div className="server-health">
            <span className={metrics?.docker ? "online" : "offline"}><i /></span>
            <div><strong>{metrics?.docker ? "زیرساخت عملیاتی" : "نیاز به بررسی"}</strong><small>{running.toLocaleString("fa-IR")} سرویس فعال از {apps.length.toLocaleString("fa-IR")}</small></div>
          </div>
          <button className="logout" onClick={onLogout}><LogOut /><span>خروج از حساب</span></button>
        </div>
      </aside>
      <main className="workspace-main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setOpen(true)}><Menu /></button>
          <div className="page-heading"><small>{subtitle}</small><h1>{title}</h1></div>
          <div className="topbar__actions">
            <label className="global-search"><Search /><input placeholder="جست‌وجوی سریع..." /></label>
            <button className="icon-button has-indicator"><Bell /><i /></button>
            <div className="profile"><span>{user.username[0]?.toUpperCase()}</span><div><strong>{user.username}</strong><small>مدیر سیستم</small></div></div>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}

