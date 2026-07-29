"use client";

import {
  ArrowUpLeft, Boxes, CheckCircle2, Clock3, FileArchive, Filter,
  Globe2, Layers3, Plus, Search, Server, UploadCloud, X,
} from "@/lib/icons";
import { FormEvent, useMemo, useRef, useState } from "react";
import type { NovaApp, UploadProgress } from "@/lib/types";
import { ago, bytes, fa, typeLabels } from "@/lib/format";
import { api, uploadSource } from "@/lib/api";
import { AppGlyph, EmptyState, Field, Modal, ProgressBar, StatusBadge } from "@/components/ui";

const appTypes = ["nextjs", "nodejs", "django", "fastapi", "flask", "php", "static", "postgres", "mongodb", "docker"];
const defaultPorts: Record<string, number> = {
  nextjs: 3000, nodejs: 3000, django: 8000, fastapi: 8000, flask: 8000,
  php: 80, static: 80, postgres: 5432, mongodb: 27017, docker: 3000,
};

export function CreateAppModal({
  close, onCreated, notify,
}: {
  close: () => void;
  onCreated: (app: NovaApp) => void;
  notify: (text: string, kind?: "success" | "error" | "info") => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<NovaApp | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [appType, setAppType] = useState("nextjs");
  const [internalPort, setInternalPort] = useState(3000);
  const formRef = useRef<HTMLFormElement>(null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const form = new FormData(event.currentTarget);
    const environment: Record<string, string> = {};
    String(form.get("environment") || "").split("\n").forEach((line) => {
      const index = line.indexOf("=");
      if (index > 0) environment[line.slice(0, index).trim()] = line.slice(index + 1).trim();
    });
    try {
      const app = await api<NovaApp>("/api/apps", { method: "POST", body: {
        name: form.get("name"), display_name: form.get("display_name"),
        app_type: form.get("app_type"), internal_port: Number(form.get("internal_port")),
        start_command: form.get("start_command"), image: form.get("image"), environment,
      } as never });
      if (["postgres", "mongodb", "docker"].includes(appType)) {
        notify("سرویس با موفقیت ساخته شد؛ اکنون می‌توانید آن را دیپلوی کنید.");
        onCreated(app);
      } else {
        setCreated(app); setStep(2);
      }
    } catch (error) { notify(error instanceof Error ? error.message : "ساخت برنامه ناموفق بود", "error"); }
    finally { setBusy(false); }
  }

  async function finish() {
    if (!created) return;
    if (file) {
      setBusy(true);
      try {
        await uploadSource(created.id, file, setProgress);
        notify("برنامه ساخته و سورس با موفقیت پردازش شد");
      } catch (error) {
        notify(error instanceof Error ? error.message : "آپلود ناموفق بود", "error");
        setBusy(false); return;
      }
    } else notify("برنامه با موفقیت ساخته شد");
    onCreated(created);
  }

  return (
    <Modal title="ساخت برنامه جدید" subtitle={step === 1 ? "مشخصات سرویس و روش اجرا را تعیین کنید." : "فایل پروژه را اضافه کنید یا بعداً ادامه دهید."} onClose={close} wide>
      <div className="stepper"><span className="active"><b>۱</b> مشخصات</span><i /><span className={step === 2 ? "active" : ""}><b>۲</b> سورس پروژه</span></div>
      {step === 1 ? (
        <form ref={formRef} className="form" onSubmit={create}>
          <div className="form-grid">
            <Field label="نام نمایشی"><input name="display_name" placeholder="وب‌سایت فروشگاهی" /></Field>
            <Field label="شناسه یکتا" hint="فقط حروف انگلیسی کوچک، عدد و خط تیره"><input name="name" dir="ltr" pattern="[a-z][a-z0-9-]{1,39}" placeholder="my-store" required /></Field>
          </div>
          <div className="form-grid">
            <Field label="نوع برنامه"><select name="app_type" value={appType} onChange={(event) => { const type = event.target.value; setAppType(type); setInternalPort(defaultPorts[type]); }}>{appTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></Field>
            <Field label="پورت داخلی"><input name="internal_port" dir="ltr" type="number" min={1} max={65535} value={internalPort} onChange={(event) => setInternalPort(Number(event.target.value))} required /></Field>
          </div>
          <Field label="دستور اجرا" hint="در صورت خالی بودن، دستور استاندارد فریم‌ورک استفاده می‌شود."><input name="start_command" dir="ltr" placeholder="npm start" /></Field>
          <Field label="Docker Image" hint={appType === "docker" ? "برای این نوع سرویس الزامی است." : "فقط برای نوع Docker Image"}><input name="image" dir="ltr" placeholder="ghcr.io/user/application:latest" required={appType === "docker"} /></Field>
          <Field label="متغیرهای محیطی" hint="هر متغیر در یک خط با ساختار KEY=VALUE"><textarea name="environment" dir="ltr" rows={4} placeholder={"NODE_ENV=production\nAPI_URL=https://api.example.com"} /></Field>
          <div className="modal__actions"><button type="button" className="button button--ghost" onClick={close}>انصراف</button><button className="button button--primary" disabled={busy}>{busy ? "در حال ساخت..." : "ادامه"} <ArrowUpLeft /></button></div>
        </form>
      ) : (
        <div className="source-step">
          {!progress ? (
            <label className={`dropzone ${file ? "dropzone--selected" : ""}`}>
              <input type="file" accept=".zip" onChange={(event) => setFile(event.target.files?.[0] || null)} />
              <span><FileArchive /></span>
              {file ? <><h3>{file.name}</h3><p>{bytes(file.size)} · آماده ارسال</p><button type="button" className="text-button" onClick={(event) => { event.preventDefault(); setFile(null); }}><X /> حذف فایل</button></> : <><h3>فایل ZIP پروژه را اینجا رها کنید</h3><p>یا برای انتخاب فایل کلیک کنید</p><small>فایل پس از آپلود، بررسی و در پوشه برنامه Extract می‌شود.</small></>}
            </label>
          ) : (
            <div className="upload-progress-card">
              <header><span><UploadCloud /></span><div><strong>{file?.name}</strong><small>{progress.phase === "processing" ? "آپلود کامل شد؛ در حال بررسی و استخراج..." : progress.phase === "completed" ? "فایل با موفقیت پردازش شد" : "در حال انتقال امن به سرور"}</small></div><b>{fa(progress.percent, 0)}٪</b></header>
              <ProgressBar value={progress.percent} tone={progress.phase === "completed" ? "success" : "primary"} />
              <footer><span>{bytes(progress.loaded)} از {bytes(progress.total)}</span><span>{progress.speed ? `${bytes(progress.speed)}/s` : "در حال پردازش"}</span><span>{progress.eta ? `${fa(progress.eta, 0)} ثانیه باقی‌مانده` : progress.phase === "processing" ? "استخراج فایل‌ها" : ""}</span></footer>
            </div>
          )}
          <div className="modal__actions"><button className="button button--ghost" disabled={busy} onClick={() => created && onCreated(created)}>بعداً آپلود می‌کنم</button><button className="button button--primary" disabled={busy || !file} onClick={finish}>{busy ? progress?.phase === "processing" ? "در حال پردازش..." : "در حال آپلود..." : "آپلود و تکمیل"} <UploadCloud /></button></div>
        </div>
      )}
    </Modal>
  );
}

export default function AppsView({
  apps, navigate, onCreate,
}: { apps: NovaApp[]; navigate: (route: string) => void; onCreate: () => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = useMemo(() => apps.filter((app) => {
    const matchesQuery = `${app.name} ${app.display_name} ${app.domain}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (status === "all" || app.status === status);
  }), [apps, query, status]);

  return (
    <>
      <section className="section-hero">
        <div><span className="eyebrow"><Layers3 /> مدیریت سرویس‌ها</span><h2>برنامه‌های شما</h2><p>دیپلوی، منابع، دامنه و فایل‌های هر سرویس را یکپارچه مدیریت کنید.</p></div>
        <button className="button button--primary button--large" onClick={onCreate}><Plus /> ساخت برنامه</button>
      </section>
      <section className="toolbar">
        <label className="toolbar__search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجو در نام، دامنه یا شناسه..." /></label>
        <label className="toolbar__filter"><Filter /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">همه وضعیت‌ها</option><option value="running">در حال اجرا</option><option value="stopped">متوقف</option><option value="failed">دارای خطا</option></select></label>
        <div className="toolbar__count"><Boxes /> {fa(filtered.length, 0)} برنامه</div>
      </section>
      {filtered.length ? (
        <section className="apps-grid">
          {filtered.map((app) => (
            <article className="app-card" key={app.id} onClick={() => navigate(`app/${app.id}`)}>
              <header><AppGlyph type={app.app_type} size="lg" /><div><h3>{app.display_name}</h3><p>{typeLabels[app.app_type]} · {app.name}</p></div><StatusBadge status={app.status} pulse={app.status === "running"} /></header>
              <div className="app-card__address"><Globe2 /><span>{app.domain || `127.0.0.1:${app.host_port}`}</span></div>
              <div className="app-card__facts">
                <span><FileArchive /><b>{app.source_files ? `${fa(app.source_files, 0)} فایل` : "بدون سورس"}</b><small>{bytes(app.source_size)}</small></span>
                <span><UploadCloud /><b>{app.last_upload_name || "آپلود نشده"}</b><small>{app.last_upload_at ? ago(app.last_upload_at) : "فایلی ثبت نشده"}</small></span>
                <span><Server /><b>Port {app.internal_port}</b><small>Host {app.host_port}</small></span>
              </div>
              <footer><span><Clock3 /> ایجاد {ago(app.created_at)}</span><button className="text-button">مدیریت برنامه <ArrowUpLeft /></button></footer>
            </article>
          ))}
        </section>
      ) : (
        <section className="panel"><EmptyState title="برنامه‌ای پیدا نشد" text={apps.length ? "فیلتر یا عبارت جست‌وجو را تغییر دهید." : "اولین برنامه را بسازید و سورس خود را آپلود کنید."} action={!apps.length && <button className="button button--primary" onClick={onCreate}><Plus /> ساخت اولین برنامه</button>} /></section>
      )}
    </>
  );
}
