"use client";

import {
  Activity, AlertTriangle, ArchiveRestore, BellRing, Bot, CheckCircle2, Clock3,
  CircleStop, Cpu, DatabaseBackup, Download, ExternalLink, FolderOpen, Globe2, HardDrive, History,
  KeyRound, LoaderCircle, MemoryStick, PencilSimple, Play, PlugsConnected, Power, RefreshCcw, Rocket,
  Server, ShieldCheck, Trash2, X,
} from "@/lib/icons";
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

function ScheduleModal({
  apps, schedule, close, saved,
}: {
  apps: NovaApp[];
  schedule?: BackupSchedule | null;
  close: () => void;
  saved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); const form = new FormData(event.currentTarget);
    try {
      await api(schedule ? `/api/backups/schedules/${schedule.id}` : "/api/backups/schedules", {
        method: schedule ? "PUT" : "POST",
        body: {
          app_id: Number(form.get("app_id")),
          enabled: schedule?.enabled ?? true,
          destination: form.get("destination"),
          interval_value: Number(form.get("interval_value")),
          interval_unit: form.get("interval_unit"),
          retention: Number(form.get("retention")),
        },
      });
      saved(); close();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={schedule ? "ویرایش زمان‌بندی" : "زمان‌بندی بکاپ"} subtitle="نسخه‌های پشتیبان را به‌صورت خودکار ایجاد کنید." onClose={close}>
      <form className="form" onSubmit={submit}>
        <Field label="برنامه"><select name="app_id" defaultValue={schedule?.app_id}>{apps.map((app) => <option key={app.id} value={app.id}>{app.display_name}</option>)}</select></Field>
        <div className="form-grid">
          <Field label="فاصله اجرا"><input name="interval_value" type="number" min={1} defaultValue={schedule?.interval_value ?? 24} /></Field>
          <Field label="واحد"><select name="interval_unit" defaultValue={schedule?.interval_unit || "hours"}><option value="hours">ساعت</option><option value="days">روز</option><option value="minutes">دقیقه</option></select></Field>
        </div>
        <div className="form-grid">
          <Field label="مقصد"><select name="destination" defaultValue={schedule?.destination || "local"}><option value="local">روی سرور</option><option value="telegram">تلگرام</option></select></Field>
          <Field label="تعداد نگه‌داری"><input name="retention" type="number" min={1} max={100} defaultValue={schedule?.retention ?? 7} /></Field>
        </div>
        <div className="modal__actions"><button type="button" className="button button--ghost" onClick={close}>انصراف</button><button className="button button--primary" disabled={busy}>{busy ? "در حال ذخیره..." : schedule ? "ذخیره تغییرات" : "ساخت زمان‌بندی"}</button></div>
      </form>
    </Modal>
  );
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

function QuickBackupModal({
  apps, close, create,
}: {
  apps: NovaApp[];
  close: () => void;
  create: (appId: number, destination: "local" | "telegram") => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await create(
        Number(form.get("app_id")),
        String(form.get("destination")) as "local" | "telegram",
      );
      close();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="ایجاد بکاپ فوری" subtitle="سرویس و مقصد نسخه پشتیبان را انتخاب کنید." onClose={close}>
      <form className="form" onSubmit={submit}>
        <Field label="سرویس"><select name="app_id">{apps.map((app) => <option key={app.id} value={app.id}>{app.display_name} · {app.name}</option>)}</select></Field>
        <Field label="مقصد"><select name="destination"><option value="local">ذخیره روی سرور</option><option value="telegram">ارسال در تلگرام</option></select></Field>
        <div className="info-banner"><DatabaseBackup /><p><strong>بکاپ کامل</strong><span>سورس برنامه، Manifest و در سرویس‌های دیتابیس فایل Dump ذخیره می‌شود.</span></p></div>
        <div className="modal__actions"><button type="button" className="button button--ghost" onClick={close}>انصراف</button><button className="button button--primary" disabled={busy}>{busy ? "در حال شروع..." : "ایجاد بکاپ"}</button></div>
      </form>
    </Modal>
  );
}

export function BackupsView({
  apps, notify,
}: { apps: NovaApp[]; notify: (text: string, kind?: "success" | "error" | "info") => void }) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [telegram, setTelegram] = useState<{ configured: boolean; chat_id: string; token_hint: string }>({ configured: false, chat_id: "", token_hint: "" });
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<BackupSchedule | null>(null);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
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
  async function toggleSchedule(item: BackupSchedule) {
    try {
      await api(`/api/backups/schedules/${item.id}`, {
        method: "PUT",
        body: {
          app_id: item.app_id,
          enabled: !item.enabled,
          destination: item.destination,
          interval_value: item.interval_value,
          interval_unit: item.interval_unit,
          retention: item.retention,
        },
      });
      await load();
      notify(item.enabled ? "زمان‌بندی موقتاً متوقف شد" : "زمان‌بندی دوباره فعال شد");
    } catch (error) {
      notify(error instanceof Error ? error.message : "تغییر وضعیت زمان‌بندی ناموفق بود", "error");
    }
  }
  async function removeSchedule(item: BackupSchedule) {
    if (!confirm(`زمان‌بندی بکاپ ${apps.find((app) => app.id === item.app_id)?.display_name || ""} حذف شود؟`)) return;
    try {
      await api(`/api/backups/schedules/${item.id}`, { method: "DELETE" });
      await load();
      notify("زمان‌بندی حذف شد");
    } catch (error) {
      notify(error instanceof Error ? error.message : "حذف زمان‌بندی ناموفق بود", "error");
    }
  }
  const totalSize = backups.reduce((sum, item) => sum + item.size, 0);
  return (
    <>
      <section className="section-hero"><div><span className="eyebrow"><DatabaseBackup /> حفاظت از داده‌ها</span><h2>بکاپ و بازیابی</h2><p>نسخه‌های محلی، ارسال تلگرام و زمان‌بندی نگه‌داری.</p></div><button className="button button--primary" disabled={!apps.length} onClick={() => setQuickOpen(true)}><DatabaseBackup /> بکاپ سریع</button></section>
      <section className="backup-top">
        <article className="panel backup-summary"><span><ArchiveRestore /></span><div><small>فضای مصرف‌شده بکاپ</small><strong>{bytes(totalSize)}</strong><p>{fa(backups.length, 0)} نسخه پشتیبان</p></div></article>
        <article className="panel integration-card"><span className={telegram.configured ? "connected" : ""}><Bot /></span><div><small>یکپارچه‌سازی تلگرام</small><strong>{telegram.configured ? "متصل و آماده" : "تنظیم نشده"}</strong><p>{telegram.configured ? `Chat ID: ${telegram.chat_id} · ${telegram.token_hint}` : "ارسال مستقیم بکاپ به مدیر"}</p></div><button className="button button--soft" onClick={() => setTelegramOpen(true)}>{telegram.configured ? "ویرایش" : "اتصال"}</button>{telegram.configured && <button className="text-button" onClick={testTelegram}>تست</button>}</article>
      </section>
      <section className="panel schedules">
        <header className="panel__head"><div><h3>زمان‌بندی خودکار</h3><p>بکاپ دوره‌ای و حذف نسخه‌های قدیمی</p></div><button className="button button--soft" onClick={() => setScheduleOpen(true)}>زمان‌بندی جدید</button></header>
        <div className="schedule-grid">
          {schedules.map((item) => {
            const app = apps.find((candidate) => candidate.id === item.app_id);
            return (
              <div key={item.id} className={!item.enabled ? "is-paused" : ""}>
                <AppGlyph type={app?.app_type || "docker"} />
                <p><strong>{app?.display_name || "برنامه حذف‌شده"}</strong><small>هر {fa(item.interval_value, 0)} {item.interval_unit === "days" ? "روز" : item.interval_unit === "hours" ? "ساعت" : "دقیقه"} · {item.destination === "telegram" ? "تلگرام" : "سرور"} · نگه‌داری {fa(item.retention, 0)} نسخه</small></p>
                <span><Clock3 /> {item.enabled ? `اجرای بعدی: ${dateTime(item.next_run)}` : "متوقف‌شده توسط مدیر"}</span>
                <StatusBadge status={item.enabled ? "running" : "stopped"} />
                <div className="schedule-actions">
                  <button title="ویرایش" onClick={() => { setEditingSchedule(item); setScheduleOpen(true); }}><PencilSimple /></button>
                  <button title={item.enabled ? "توقف موقت" : "ادامه"} onClick={() => toggleSchedule(item)}>{item.enabled ? <CircleStop /> : <Play />}</button>
                  <button className="danger" title="حذف" onClick={() => removeSchedule(item)}><Trash2 /></button>
                </div>
              </div>
            );
          })}
          {!schedules.length && <EmptyState title="زمان‌بندی ندارید" text="برای حفاظت پیوسته از برنامه‌ها یک برنامه بکاپ بسازید." />}
        </div>
      </section>
      <section className="panel">
        <header className="panel__head"><div><h3>آرشیو بکاپ‌ها</h3><p>دانلود یا بازگردانی نسخه‌های ذخیره‌شده</p></div><button className="icon-button" onClick={load}><RefreshCcw /></button></header>
        <div className="backup-table">{backups.map((item) => { const app = apps.find((candidate) => candidate.id === item.app_id); return <article key={item.id}><span className="backup-table__icon"><DatabaseBackup /></span><div><strong>{app?.display_name || "برنامه حذف‌شده"}</strong><small>{item.filename}</small></div><span>{dateTime(item.created_at)}</span><b>{bytes(item.size)}</b><span>{item.destination === "telegram" ? "تلگرام" : "روی سرور"}</span><StatusBadge status={item.status} /><div>{item.status === "completed" && <><a className="icon-button" href={`/api/backups/items/${item.id}/download`}><Download /></a><button className="icon-button" onClick={() => restore(item.id)}><ArchiveRestore /></button></>}<button className="icon-button icon-button--danger" onClick={() => remove(item.id)}><Trash2 /></button></div></article>; })}{!backups.length && <EmptyState title="بکاپی وجود ندارد" text="یک نسخه پشتیبان دستی یا زمان‌بندی‌شده ایجاد کنید." />}</div>
      </section>
      {scheduleOpen && <ScheduleModal apps={apps} schedule={editingSchedule} close={() => { setScheduleOpen(false); setEditingSchedule(null); }} saved={() => { void load(); notify(editingSchedule ? "زمان‌بندی ویرایش شد" : "زمان‌بندی ساخته شد"); }} />}
      {telegramOpen && <TelegramModal close={() => setTelegramOpen(false)} saved={() => { void load(); notify("ربات تلگرام متصل شد"); }} />}
      {quickOpen && <QuickBackupModal apps={apps} close={() => setQuickOpen(false)} create={create} />}
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

export function DomainsView({ apps, navigate }: { apps: NovaApp[]; navigate: (route: string) => void }) {
  const domains = apps.flatMap((app) => (app.domains || []).map((domain, index) => ({ app, domain, primary: index === 0 })));
  return (
    <>
      <section className="section-hero"><div><span className="eyebrow"><Globe2 /> Nginx Host Routing</span><h2>دامنه‌های متصل</h2><p>همهٔ دامنه‌ها می‌توانند روی یک IP مشترک باشند؛ Nginx درخواست را بر اساس hostname به سرویس مقصد می‌فرستد.</p></div></section>
      <section className="panel infrastructure-table">
        <header><span>سرویس</span><span>دامنه</span><span>نوع</span><span>Upstream داخلی</span><span>وضعیت</span><i /></header>
        {domains.map(({ app, domain, primary }) => <article key={`${app.id}-${domain}`}><div><AppGlyph type={app.app_type} /><p><strong>{app.display_name}</strong><small dir="ltr">{app.name}</small></p></div><code dir="ltr">{domain}</code><span>{primary ? "اصلی" : "Alias"}</span><code dir="ltr">127.0.0.1:{app.host_port}</code><StatusBadge status={app.status} /><button onClick={() => navigate(`app/${app.id}`)}><ExternalLink /></button></article>)}
        {!domains.length && <EmptyState title="دامنه‌ای متصل نشده" text="از صفحهٔ هر سرویس وارد تب دامنه و SSL شوید." />}
      </section>
    </>
  );
}

export function StorageView({ apps, navigate }: { apps: NovaApp[]; navigate: (route: string) => void }) {
  return (
    <>
      <section className="section-hero"><div><span className="eyebrow"><HardDrive /> Persistent Storage</span><h2>مسیرهای دائمی</h2><p>سورس برنامه‌ها و volumeهای دیتابیس که با ساخت مجدد کانتینر حذف نمی‌شوند.</p></div></section>
      <section className="infrastructure-cards">
        {apps.map((app) => <article className="panel" key={app.id}><span><FolderOpen /></span><div><h3>{app.display_name}</h3><code dir="ltr">{app.source_dir}</code><p>{fa(app.source_files, 0)} فایل · {bytes(app.source_size)}</p>{app.volume_name && <small dir="ltr">Volume: {app.volume_name}</small>}</div><button className="button button--soft" onClick={() => navigate(`app/${app.id}`)}>مدیریت فایل‌ها</button></article>)}
      </section>
    </>
  );
}

export function PortsView({ apps, navigate }: { apps: NovaApp[]; navigate: (route: string) => void }) {
  return (
    <>
      <section className="section-hero"><div><span className="eyebrow"><PlugsConnected /> Port Mapping</span><h2>پورت و مسیریابی</h2><p>نگاشت امن پورت‌های کانتینر روی loopback میزبان.</p></div></section>
      <section className="panel infrastructure-table infrastructure-table--ports">
        <header><span>سرویس</span><span>پورت کانتینر</span><span>پورت میزبان</span><span>Bind address</span><span>دسترسی</span><i /></header>
        {apps.map((app) => <article key={app.id}><div><AppGlyph type={app.app_type} /><p><strong>{app.display_name}</strong><small dir="ltr">{app.container_name}</small></p></div><code dir="ltr">{app.internal_port}/tcp</code><code dir="ltr">{app.host_port}</code><code dir="ltr">127.0.0.1</code><span>{app.domains?.length ? "از طریق Nginx" : "فقط محلی"}</span><button onClick={() => navigate(`app/${app.id}`)}><ExternalLink /></button></article>)}
      </section>
    </>
  );
}

export { TelegramModal };
