"use client";

import {
  Activity, AlertTriangle, ArchiveRestore, BellRing, Bot, CheckCircle2, Clock3,
  Cpu, DatabaseBackup, Download, HardDrive, History, KeyRound, LoaderCircle,
  MemoryStick, Power, RefreshCcw, Rocket, Server, ShieldCheck, Trash2, X,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { ActivityItem, Backup, BackupSchedule, Deployment, NovaApp, SystemMetrics } from "@/lib/types";
import { ago, bytes, dateTime, duration, fa, stageLabels } from "@/lib/format";
import { api } from "@/lib/api";
import { AppGlyph, EmptyState, Field, Modal, ProgressBar, StatusBadge } from "@/components/ui";

export function DeploymentsView({ apps, deployments }: { apps: NovaApp[]; deployments: Deployment[] }) {
  const active = deployments.filter((item) => ["running", "queued"].includes(item.status)).length;
  const completed = deployments.filter((item) => item.status === "completed").length;
  const failed = deployments.filter((item) => item.status === "failed").length;
  return (
    <>
      <section className="section-hero"><div><span className="eyebrow"><Rocket /> چرخه انتشار</span><h2>دیپلوی‌ها</h2><p>وضعیت Build و انتشار تمام برنامه‌ها را دنبال کنید.</p></div></section>
      <section className="summary-cards">
        <div><span className="summary-cards__icon summary-cards__icon--blue"><LoaderCircle /></span><p><small>در حال اجرا</small><strong>{fa(active, 0)}</strong></p></div>
        <div><span className="summary-cards__icon summary-cards__icon--green"><CheckCircle2 /></span><p><small>موفق</small><strong>{fa(completed, 0)}</strong></p></div>
        <div><span className="summary-cards__icon summary-cards__icon--red"><X /></span><p><small>ناموفق</small><strong>{fa(failed, 0)}</strong></p></div>
        <div><span className="summary-cards__icon summary-cards__icon--orange"><History /></span><p><small>کل انتشارها</small><strong>{fa(deployments.length, 0)}</strong></p></div>
      </section>
      <section className="panel">
        <header className="panel__head"><div><h3>تاریخچه انتشار</h3><p>جدیدترین عملیات در ابتدای فهرست</p></div></header>
        <div className="deployment-table">
          {deployments.map((item) => {
            const app = apps.find((candidate) => candidate.id === item.app_id);
            return <article key={item.id}>
              <AppGlyph type={app?.app_type || "docker"} />
              <div className="deployment-table__app"><strong>{app?.display_name || "برنامه حذف‌شده"}</strong><small>Deployment #{item.id}</small></div>
              <div className="deployment-table__stage"><b>{stageLabels[item.stage] || item.stage}</b>{["running", "queued"].includes(item.status) ? <ProgressBar value={item.progress} /> : <small dir="ltr">{item.image || "—"}</small>}</div>
              <span><Clock3 /> {dateTime(item.created_at)}</span>
              <span>{duration(item.duration_seconds)}</span>
              <StatusBadge status={item.status} pulse={item.status === "running"} />
            </article>;
          })}
          {!deployments.length && <EmptyState title="دیپلویی ثبت نشده" text="انتشارهای برنامه‌ها در این صفحه نمایش داده می‌شوند." />}
        </div>
      </section>
    </>
  );
}

function ScheduleModal({ apps, close, saved }: { apps: NovaApp[]; close: () => void; saved: () => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); const form = new FormData(event.currentTarget);
    await api("/api/backups/schedules", { method: "POST", body: {
      app_id: Number(form.get("app_id")), enabled: true, destination: form.get("destination"),
      interval_value: Number(form.get("interval_value")), interval_unit: form.get("interval_unit"),
      retention: Number(form.get("retention")),
    } as never });
    saved(); close();
  }
  return <Modal title="زمان‌بندی بکاپ" subtitle="نسخه‌های پشتیبان را به‌صورت خودکار ایجاد کنید." onClose={close}><form className="form" onSubmit={submit}><Field label="برنامه"><select name="app_id">{apps.map((app) => <option key={app.id} value={app.id}>{app.display_name}</option>)}</select></Field><div className="form-grid"><Field label="فاصله اجرا"><input name="interval_value" type="number" min={1} defaultValue={24} /></Field><Field label="واحد"><select name="interval_unit"><option value="hours">ساعت</option><option value="days">روز</option><option value="minutes">دقیقه</option></select></Field></div><div className="form-grid"><Field label="مقصد"><select name="destination"><option value="local">روی سرور</option><option value="telegram">تلگرام</option></select></Field><Field label="تعداد نگه‌داری"><input name="retention" type="number" min={1} max={100} defaultValue={7} /></Field></div><div className="modal__actions"><button type="button" className="button button--ghost" onClick={close}>انصراف</button><button className="button button--primary" disabled={busy}>ساخت زمان‌بندی</button></div></form></Modal>;
}

function TelegramModal({ close, saved }: { close: () => void; saved: () => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    try { await api("/api/settings/telegram", { method: "PUT", body: { bot_token: form.get("token"), admin_chat_id: form.get("chat_id") } as never }); saved(); close(); }
    catch (exception) { setError(exception instanceof Error ? exception.message : "اتصال ناموفق بود"); setBusy(false); }
  }
  return <Modal title="اتصال ربات تلگرام" subtitle="برای ارسال خودکار بکاپ‌ها" onClose={close}><form className="form" onSubmit={submit}><div className="info-banner"><Bot /><p><strong>راهنمای سریع</strong><span>در BotFather ربات بسازید، یک پیام به آن بفرستید و سپس Token و Chat ID عددی را وارد کنید.</span></p></div><Field label="Bot Token"><input name="token" dir="ltr" type="password" placeholder="123456:ABC..." required /></Field><Field label="Admin Chat ID"><input name="chat_id" dir="ltr" placeholder="123456789" required /></Field>{error && <div className="form-error">{error}</div>}<div className="modal__actions"><button type="button" className="button button--ghost" onClick={close}>انصراف</button><button className="button button--primary" disabled={busy}>{busy ? "در حال بررسی..." : "اتصال ربات"}</button></div></form></Modal>;
}

export function BackupsView({
  apps, notify,
}: { apps: NovaApp[]; notify: (text: string, kind?: "success" | "error" | "info") => void }) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [telegram, setTelegram] = useState<{ configured: boolean; chat_id: string; token_hint: string }>({ configured: false, chat_id: "", token_hint: "" });
  const [scheduleOpen, setScheduleOpen] = useState(false); const [telegramOpen, setTelegramOpen] = useState(false);
  async function load() {
    const [backupData, scheduleData, telegramData] = await Promise.all([
      api<Backup[]>("/api/backups"), api<BackupSchedule[]>("/api/backups/schedules/all"),
      api<{ configured: boolean; chat_id: string; token_hint: string }>("/api/settings/telegram"),
    ]);
    setBackups(backupData); setSchedules(scheduleData); setTelegram(telegramData);
  }
  useEffect(() => { void load(); }, []);
  async function create(appId: number, destination: "local" | "telegram") {
    try { await api(`/api/backups/apps/${appId}`, { method: "POST", body: { destination } as never }); notify("ساخت بکاپ در پس‌زمینه آغاز شد"); window.setTimeout(load, 1200); }
    catch (error) { notify(error instanceof Error ? error.message : "عملیات ناموفق بود", "error"); }
  }
  async function remove(id: number) {
    if (!confirm("این فایل بکاپ حذف شود؟")) return;
    await api(`/api/backups/items/${id}`, { method: "DELETE" }); await load(); notify("بکاپ حذف شد");
  }
  async function restore(id: number) {
    if (!confirm("سورس فعلی با این بکاپ جایگزین و مجدداً دیپلوی شود؟")) return;
    await api(`/api/backups/items/${id}/restore`, { method: "POST" }); notify("بازیابی در پس‌زمینه آغاز شد");
  }
  async function testTelegram() {
    try { await api("/api/settings/telegram/test", { method: "POST" }); notify("پیام آزمایشی ارسال شد"); }
    catch (error) { notify(error instanceof Error ? error.message : "ارسال ناموفق بود", "error"); }
  }
  const totalSize = backups.reduce((sum, item) => sum + item.size, 0);
  return (
    <>
      <section className="section-hero"><div><span className="eyebrow"><DatabaseBackup /> حفاظت از داده‌ها</span><h2>بکاپ و بازیابی</h2><p>نسخه‌های محلی، ارسال تلگرام و زمان‌بندی نگه‌داری.</p></div><button className="button button--primary" disabled={!apps.length} onClick={() => apps[0] && create(apps[0].id, "local")}><DatabaseBackup /> بکاپ سریع</button></section>
      <section className="backup-top">
        <article className="panel backup-summary"><span><ArchiveRestore /></span><div><small>فضای مصرف‌شده بکاپ</small><strong>{bytes(totalSize)}</strong><p>{fa(backups.length, 0)} نسخه پشتیبان</p></div></article>
        <article className="panel integration-card"><span className={telegram.configured ? "connected" : ""}><Bot /></span><div><small>یکپارچه‌سازی تلگرام</small><strong>{telegram.configured ? "متصل و آماده" : "تنظیم نشده"}</strong><p>{telegram.configured ? `Chat ID: ${telegram.chat_id} · ${telegram.token_hint}` : "ارسال مستقیم بکاپ به مدیر"}</p></div><button className="button button--soft" onClick={() => setTelegramOpen(true)}>{telegram.configured ? "ویرایش" : "اتصال"}</button>{telegram.configured && <button className="text-button" onClick={testTelegram}>تست</button>}</article>
      </section>
      <section className="panel schedules">
        <header className="panel__head"><div><h3>زمان‌بندی خودکار</h3><p>بکاپ دوره‌ای و حذف نسخه‌های قدیمی</p></div><button className="button button--soft" onClick={() => setScheduleOpen(true)}>زمان‌بندی جدید</button></header>
        <div className="schedule-grid">{schedules.map((item) => { const app = apps.find((candidate) => candidate.id === item.app_id); return <div key={item.id}><AppGlyph type={app?.app_type || "docker"} /><p><strong>{app?.display_name || "برنامه حذف‌شده"}</strong><small>هر {fa(item.interval_value, 0)} {item.interval_unit === "days" ? "روز" : item.interval_unit === "hours" ? "ساعت" : "دقیقه"} · {item.destination === "telegram" ? "تلگرام" : "سرور"}</small></p><span><Clock3 /> اجرای بعدی: {dateTime(item.next_run)}</span><StatusBadge status={item.enabled ? "running" : "stopped"} /></div>; })}{!schedules.length && <EmptyState title="زمان‌بندی ندارید" text="برای حفاظت پیوسته از برنامه‌ها یک برنامه بکاپ بسازید." />}</div>
      </section>
      <section className="panel">
        <header className="panel__head"><div><h3>آرشیو بکاپ‌ها</h3><p>دانلود یا بازگردانی نسخه‌های ذخیره‌شده</p></div><button className="icon-button" onClick={load}><RefreshCcw /></button></header>
        <div className="backup-table">{backups.map((item) => { const app = apps.find((candidate) => candidate.id === item.app_id); return <article key={item.id}><span className="backup-table__icon"><DatabaseBackup /></span><div><strong>{app?.display_name || "برنامه حذف‌شده"}</strong><small>{item.filename}</small></div><span>{dateTime(item.created_at)}</span><b>{bytes(item.size)}</b><span>{item.destination === "telegram" ? "تلگرام" : "روی سرور"}</span><StatusBadge status={item.status} /><div>{item.status === "completed" && <><a className="icon-button" href={`/api/backups/items/${item.id}/download`}><Download /></a><button className="icon-button" onClick={() => restore(item.id)}><ArchiveRestore /></button></>}<button className="icon-button icon-button--danger" onClick={() => remove(item.id)}><Trash2 /></button></div></article>; })}{!backups.length && <EmptyState title="بکاپی وجود ندارد" text="یک نسخه پشتیبان دستی یا زمان‌بندی‌شده ایجاد کنید." />}</div>
      </section>
      {scheduleOpen && <ScheduleModal apps={apps} close={() => setScheduleOpen(false)} saved={() => { void load(); notify("زمان‌بندی ساخته شد"); }} />}
      {telegramOpen && <TelegramModal close={() => setTelegramOpen(false)} saved={() => { void load(); notify("ربات تلگرام متصل شد"); }} />}
    </>
  );
}

export function ActivityView({ activity }: { activity: ActivityItem[] }) {
  return <><section className="section-hero"><div><span className="eyebrow"><Activity /> ممیزی سیستم</span><h2>گزارش فعالیت</h2><p>تاریخچه عملیات و رویدادهای مدیریتی.</p></div></section><section className="panel"><div className="audit-list">{activity.map((item) => <article key={item.id}><span className={`audit-list__icon audit-list__icon--${item.level}`}>{item.level === "error" ? <AlertTriangle /> : <CheckCircle2 />}</span><div><strong>{item.action.replaceAll("_", " ")}</strong><p>{item.detail}</p></div><time>{dateTime(item.created_at)}<small>{ago(item.created_at)}</small></time></article>)}{!activity.length && <EmptyState title="رویدادی وجود ندارد" text="عملیات انجام‌شده در این قسمت ثبت می‌شوند." />}</div></section></>;
}

export function SystemView({ metrics, notify }: { metrics: SystemMetrics; notify: (text: string, kind?: "success" | "error" | "info") => void }) {
  async function action(value: "RESTART" | "SHUTDOWN") {
    if (prompt(`برای تأیید عبارت ${value} را وارد کنید:`) !== value) return;
    try { await api("/api/system/action", { method: "POST", body: { confirmation: value } as never }); notify("دستور برای سرور ارسال شد"); }
    catch (error) { notify(error instanceof Error ? error.message : "اجرای دستور ناموفق بود", "error"); }
  }
  const uptimeHours = Math.floor(metrics.uptime_seconds / 3600);
  return (
    <>
      <section className="section-hero"><div><span className="eyebrow"><Server /> زیرساخت میزبان</span><h2>وضعیت سرور</h2><p>سلامت سرویس‌ها و مصرف منابع سیستم.</p></div><span className={`system-state ${metrics.docker ? "online" : "offline"}`}><i /> {metrics.docker ? "سرور عملیاتی است" : "نیاز به بررسی"}</span></section>
      <section className="system-resources">
        {[["CPU", metrics.cpu_percent, `${fa(metrics.cpu_count, 0)} هسته`, Cpu], ["RAM", metrics.memory_percent, `${bytes(metrics.memory_used)} / ${bytes(metrics.memory_total)}`, MemoryStick], ["Disk", metrics.disk_percent, `${bytes(metrics.disk_free)} آزاد`, HardDrive]].map(([label, percent, detail, Icon]) => { const ResourceIcon = Icon as typeof Cpu; return <article className="panel" key={label as string}><span><ResourceIcon /></span><div><small>{label as string}</small><strong>{fa(percent as number)}٪</strong><p>{detail as string}</p><ProgressBar value={percent as number} /></div></article>; })}
      </section>
      <div className="two-columns">
        <section className="panel"><header className="panel__head"><div><h3>مشخصات میزبان</h3><p>اطلاعات سیستم عامل و سرویس‌ها</p></div></header><dl className="server-specs"><div><dt>Hostname</dt><dd dir="ltr">{metrics.hostname}</dd></div><div><dt>سیستم عامل</dt><dd dir="ltr">{metrics.os}</dd></div><div><dt>Uptime</dt><dd>{fa(uptimeHours, 0)} ساعت</dd></div><div><dt>Load Average</dt><dd dir="ltr">{metrics.load.map((item) => item.toFixed(2)).join(" / ")}</dd></div><div><dt>Docker Engine</dt><dd className={metrics.docker ? "text-success" : "text-danger"}>{metrics.docker ? "Active" : "Unavailable"}</dd></div><div><dt>Nginx</dt><dd>{metrics.nginx ? "Installed" : "Unavailable"}</dd></div></dl></section>
        <section className="panel danger-panel"><header className="panel__head"><div><h3>کنترل سیستم</h3><p>عملیات سطح سرور</p></div></header><div><AlertTriangle /><h4>احتیاط</h4><p>این عملیات تمام برنامه‌ها و اتصال فعلی شما را متوقف می‌کند.</p><div className="danger-actions"><button className="button button--danger" onClick={() => action("RESTART")}><RefreshCcw /> ری‌استارت سرور</button><button className="button button--danger" onClick={() => action("SHUTDOWN")}><Power /> خاموش کردن</button></div></div></section>
      </div>
    </>
  );
}

export function SettingsView({ telegram, openTelegram }: { telegram: { configured: boolean; chat_id: string; token_hint: string }; openTelegram: () => void }) {
  return (
    <>
      <section className="section-hero"><div><span className="eyebrow"><ShieldCheck /> تنظیمات مرکز فرمان</span><h2>امنیت و یکپارچه‌سازی</h2><p>وضعیت دسترسی‌ها و اتصال سرویس‌های خارجی.</p></div></section>
      <div className="settings-grid">
        <article className="panel setting-card"><span><Bot /></span><div><h3>ربات تلگرام</h3><p>ارسال بکاپ و اعلان‌های مدیریتی</p><StatusBadge status={telegram.configured ? "running" : "stopped"} /></div><button className="button button--soft" onClick={openTelegram}>{telegram.configured ? "ویرایش اتصال" : "اتصال ربات"}</button></article>
        <article className="panel setting-card"><span><KeyRound /></span><div><h3>امنیت نشست</h3><p>HttpOnly Cookie، SameSite و رمزنگاری JWT</p><StatusBadge status="running" /></div></article>
        <article className="panel setting-card"><span><BellRing /></span><div><h3>اعلان‌ها</h3><p>مرکز تنظیم رخدادها و هشدارها</p><StatusBadge status="created" /></div><button className="button button--soft" disabled>به‌زودی</button></article>
      </div>
      <section className="panel security-note"><ShieldCheck /><div><h3>پیشنهاد امنیتی</h3><p>پنل را فقط پشت HTTPS استفاده کنید، دسترسی SSH را به کلید محدود کنید و از دایرکتوری <code>/var/lib/nova-server-manager</code> بکاپ خارج از سرور بگیرید.</p></div></section>
    </>
  );
}

export { TelegramModal };

