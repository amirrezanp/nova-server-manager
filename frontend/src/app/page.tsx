"use client";

import { LoaderCircle } from "@/lib/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import AuthView from "@/components/auth-view";
import Shell, { type RouteName } from "@/components/shell";
import { CreateAppModal } from "@/views/apps-view";
import AppsView from "@/views/apps-view";
import AppDetailView from "@/views/app-detail-view";
import DashboardView from "@/views/dashboard-view";
import {
  ActivityView, BackupsView, DeploymentsView, SettingsView, SystemView, TelegramModal,
} from "@/views/operations-views";
import { api, ApiError } from "@/lib/api";
import type { ActivityItem, Deployment, NovaApp, SystemMetrics } from "@/lib/types";
import { Logo, type ToastMessage, Toasts } from "@/components/ui";

function parseRoute() {
  const parts = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return { name: (parts[0] || "dashboard") as RouteName, parts };
}

export default function Home() {
  const [booting, setBooting] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);
  const [route, setRoute] = useState<{ name: RouteName; parts: string[] }>({ name: "dashboard", parts: [] });
  const [apps, setApps] = useState<NovaApp[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [telegram, setTelegram] = useState({ configured: false, chat_id: "", token_hint: "" });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((text: string, kind: "success" | "error" | "info" = "success") => {
    const id = Date.now() + Math.random();
    setToasts((items) => [...items, { id, text, kind }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 5000);
  }, []);

  const refreshBase = useCallback(async () => {
    const [appData, metricData, activityData, deploymentData] = await Promise.all([
      api<NovaApp[]>("/api/apps"),
      api<SystemMetrics>("/api/system/metrics"),
      api<ActivityItem[]>("/api/system/activity"),
      api<Deployment[]>("/api/deployments?limit=60"),
    ]);
    setApps(appData); setMetrics(metricData); setActivity(activityData); setDeployments(deploymentData);
  }, []);

  const loadTelegram = useCallback(async () => {
    try { setTelegram(await api("/api/settings/telegram")); } catch {}
  }, []);

  useEffect(() => {
    const sync = () => setRoute(parseRoute());
    window.addEventListener("hashchange", sync);
    if (!window.location.hash) window.location.hash = "#/dashboard";
    sync();
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    async function boot() {
      try {
        const status = await api<{ setup_required: boolean }>("/api/auth/status");
        setSetupRequired(status.setup_required);
        if (!status.setup_required) {
          try {
            const currentUser = await api<{ id: number; username: string }>("/api/auth/me");
            setUser(currentUser);
          } catch (error) {
            if (!(error instanceof ApiError) || error.status !== 401) throw error;
          }
        }
      } catch (error) {
        notify(error instanceof Error ? error.message : "ارتباط با سرور برقرار نشد", "error");
      } finally { setBooting(false); }
    }
    void boot();
  }, [notify]);

  useEffect(() => {
    if (!user) return;
    void refreshBase().catch((error) => notify(error instanceof Error ? error.message : "دریافت اطلاعات ناموفق بود", "error"));
    void loadTelegram();
    const timer = window.setInterval(() => void refreshBase(), 10000);
    return () => window.clearInterval(timer);
  }, [user, refreshBase, loadTelegram, notify]);

  function navigate(value: string) {
    window.location.hash = `#/${value}`;
  }
  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null); setApps([]); setMetrics(null);
  }

  const content = useMemo(() => {
    if (!metrics) return <div className="page-loader"><LoaderCircle className="spin" /><span>در حال آماده‌سازی مرکز فرمان...</span></div>;
    switch (route.name) {
      case "apps": return <AppsView apps={apps} navigate={navigate} onCreate={() => setCreateOpen(true)} />;
      case "app": {
        const id = Number(route.parts[1]);
        return Number.isFinite(id) ? <AppDetailView appId={id} maxUpload={metrics.max_upload_bytes} navigate={navigate} notify={notify} refreshApps={refreshBase} /> : <AppsView apps={apps} navigate={navigate} onCreate={() => setCreateOpen(true)} />;
      }
      case "deployments": return <DeploymentsView apps={apps} deployments={deployments} />;
      case "backups": return <BackupsView apps={apps} notify={notify} />;
      case "activity": return <ActivityView activity={activity} />;
      case "system": return <SystemView metrics={metrics} notify={notify} />;
      case "settings": return <SettingsView telegram={telegram} openTelegram={() => setTelegramOpen(true)} />;
      default: return <DashboardView apps={apps} metrics={metrics} activity={activity} deployments={deployments} navigate={navigate} onCreate={() => setCreateOpen(true)} />;
    }
  }, [route, apps, metrics, activity, deployments, notify, refreshBase, telegram]);

  if (booting) return <div className="splash"><Logo /><LoaderCircle className="spin" /><span>راه‌اندازی مرکز فرمان...</span></div>;
  if (!user) return <AuthView setupRequired={setupRequired} onAuthenticated={(authenticated) => { setUser(authenticated); setSetupRequired(false); }} />;

  return (
    <>
      <Shell route={route.name} navigate={navigate} user={user} apps={apps} metrics={metrics} onLogout={logout}>{content}</Shell>
      {createOpen && <CreateAppModal close={() => setCreateOpen(false)} notify={notify} onCreated={(app) => { setCreateOpen(false); void refreshBase(); navigate(`app/${app.id}`); }} />}
      {telegramOpen && <TelegramModal close={() => setTelegramOpen(false)} saved={() => { void loadTelegram(); notify("تنظیمات تلگرام ذخیره شد"); }} />}
      <Toasts items={toasts} dismiss={(id) => setToasts((items) => items.filter((item) => item.id !== id))} />
    </>
  );
}
