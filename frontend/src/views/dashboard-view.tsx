"use client";

import {
  Activity, ArrowUpLeft, Boxes, CheckCircle2, CircleGauge, Cpu, Database,
  HardDrive, MemoryStick, Plus, Rocket, Server, ShieldCheck, UploadCloud,
} from "@/lib/icons";
import Image from "next/image";
import type { ActivityItem, Deployment, NovaApp, SystemMetrics } from "@/lib/types";
import { ago, bytes, fa, stageLabels, typeLabels } from "@/lib/format";
import { AppGlyph, EmptyState, ProgressBar, StatusBadge } from "@/components/ui";

function ResourceCard({
  label, value, caption, percent, icon: Icon, color,
}: {
  label: string; value: string; caption: string; percent: number;
  icon: typeof Cpu; color: string;
}) {
  const radius = 32;
  const circumference = radius * 2 * Math.PI;
  return (
    <article className="resource-card">
      <div className="resource-card__top"><span style={{ color }}><Icon /></span><small>{label}</small><b>{percent > 80 ? "فشار بالا" : "نرمال"}</b></div>
      <div className="resource-card__body">
        <div><strong>{value}</strong><p>{caption}</p></div>
        <div className="radial">
          <svg viewBox="0 0 76 76"><circle cx="38" cy="38" r={radius} /><circle className="radial__value" style={{ stroke: color, strokeDasharray: circumference, strokeDashoffset: circumference - (Math.min(percent, 100) / 100) * circumference }} cx="38" cy="38" r={radius} /></svg>
          <b>{fa(percent)}٪</b>
        </div>
      </div>
    </article>
  );
}

export default function DashboardView({
  apps, metrics, activity, deployments, navigate, onCreate,
}: {
  apps: NovaApp[];
  metrics: SystemMetrics;
  activity: ActivityItem[];
  deployments: Deployment[];
  navigate: (route: string) => void;
  onCreate: () => void;
}) {
  const running = apps.filter((item) => item.status === "running").length;
  const activeDeployment = deployments.find((item) => ["queued", "running"].includes(item.status));
  const activeApp = activeDeployment ? apps.find((item) => item.id === activeDeployment.app_id) : null;
  const uptimeDays = Math.floor(metrics.uptime_seconds / 86400);

  return (
    <>
      <section className="welcome">
        <div className="welcome__copy">
          <span className="eyebrow"><ShieldCheck /> خوش آمدید، همه‌چیز آماده است</span>
          <h2>همه‌چیز <em>تحت کنترل</em> است</h2>
          <p>وضعیت سرور پایدار است و سرویس‌های مهم بدون مشکل در حال اجرا هستند.</p>
          <div className="welcome__actions">
            <button className="button button--primary" onClick={onCreate}><Plus /> برنامه جدید</button>
            <button className="button button--ghost" onClick={() => navigate("deployments")}><Rocket /> مشاهده گزارش‌ها</button>
          </div>
        </div>
        <div className="welcome__visual">
          <Image src="/nova-server-hero.webp" alt="" width={1536} height={1024} priority />
        </div>
      </section>

      <section className="resource-grid">
        <ResourceCard label="سرویس‌های فعال" value={fa(running, 0)} caption={`از ${fa(apps.length, 0)} برنامه`} percent={apps.length ? running / apps.length * 100 : 0} icon={Boxes} color="#5aa7ff" />
        <ResourceCard label="پردازنده CPU" value={`${fa(metrics.cpu_percent)}٪`} caption={`${fa(metrics.cpu_count, 0)} هسته پردازشی`} percent={metrics.cpu_percent} icon={Cpu} color="#ff7955" />
        <ResourceCard label="حافظه RAM" value={`${fa(metrics.memory_percent)}٪`} caption={`${bytes(metrics.memory_used)} / ${bytes(metrics.memory_total)}`} percent={metrics.memory_percent} icon={MemoryStick} color="#8b7cf6" />
        <ResourceCard label="فضای ذخیره‌سازی" value={`${fa(metrics.disk_percent)}٪`} caption={`${bytes(metrics.disk_free)} آزاد`} percent={metrics.disk_percent} icon={HardDrive} color="#3ad6b0" />
        <ResourceCard label="ترافیک شبکه" value={bytes(metrics.network_total)} caption="ارسال و دریافت کل" percent={Math.min(100, metrics.network_total / (1024 ** 4) * 100)} icon={Activity} color="#43a6ff" />
        <ResourceCard label="آپتایم سرور" value={`${fa(uptimeDays, 0)} روز`} caption="بدون وقفه" percent={Math.min(100, uptimeDays / 30 * 100)} icon={ShieldCheck} color="#35d394" />
      </section>

      {activeDeployment && (
        <section className="live-deploy">
          <span className="live-deploy__icon"><UploadCloud /></span>
          <div className="live-deploy__copy">
            <div><strong>دیپلوی {activeApp?.display_name || "برنامه"}</strong><span>{stageLabels[activeDeployment.stage] || activeDeployment.stage}</span></div>
            <ProgressBar value={activeDeployment.progress} />
          </div>
          <b>{fa(activeDeployment.progress, 0)}٪</b>
          <button className="button button--soft" onClick={() => navigate("deployments")}>جزئیات <ArrowUpLeft /></button>
        </section>
      )}

      <section className="dashboard-columns">
        <article className="panel panel--services">
          <header className="panel__head"><div><h3>سرویس‌های اخیر</h3><p>آخرین برنامه‌های مدیریت‌شده</p></div><button className="text-button" onClick={() => navigate("apps")}>مشاهده همه <ArrowUpLeft /></button></header>
          <div className="service-list">
            {apps.length ? apps.slice(0, 5).map((item) => (
              <button key={item.id} className="service-row" onClick={() => navigate(`app/${item.id}`)}>
                <AppGlyph type={item.app_type} />
                <div><strong>{item.display_name}</strong><small>{typeLabels[item.app_type]} · {item.domain || `127.0.0.1:${item.host_port}`}</small></div>
                <span className="service-row__source"><Database /> {item.source_files ? `${fa(item.source_files, 0)} فایل` : "بدون سورس"}</span>
                <StatusBadge status={item.status} pulse={item.status === "running"} />
                <ArrowUpLeft />
              </button>
            )) : <EmptyState title="هنوز برنامه‌ای ندارید" text="اولین سرویس را بسازید و فایل پروژه را آپلود کنید." />}
          </div>
        </article>

        <article className="panel">
          <header className="panel__head"><div><h3>رویدادهای اخیر</h3><p>فعالیت‌های مهم مرکز فرمان</p></div><button className="icon-button" onClick={() => navigate("activity")}><ArrowUpLeft /></button></header>
          <div className="timeline">
            {activity.slice(0, 6).map((item) => (
              <div className="timeline__item" key={item.id}>
                <span className={`timeline__dot timeline__dot--${item.level}`}><CheckCircle2 /></span>
                <div><strong>{item.action.replaceAll("_", " ")}</strong><p>{item.detail}</p><small>{ago(item.created_at)}</small></div>
              </div>
            ))}
            {!activity.length && <EmptyState title="رویدادی ثبت نشده" text="عملیات مدیریتی اینجا نمایش داده می‌شوند." />}
          </div>
        </article>
      </section>

      <section className="health-strip">
        <div><span><CircleGauge /></span><p>Load Average<strong>{metrics.load.map((value) => value.toFixed(2)).join(" / ")}</strong></p></div>
        <div><span><Server /></span><p>Docker Engine<strong className={metrics.docker ? "text-success" : "text-danger"}>{metrics.docker ? "فعال و آماده" : "در دسترس نیست"}</strong></p></div>
        <div><span><ShieldCheck /></span><p>Nginx Proxy<strong>{metrics.nginx ? "نصب و فعال" : "در دسترس نیست"}</strong></p></div>
        <div><span><HardDrive /></span><p>حداکثر آپلود<strong>{bytes(metrics.max_upload_bytes)}</strong></p></div>
      </section>
    </>
  );
}
