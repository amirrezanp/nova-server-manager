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
  const [type, setType] = useState("all");
  const [domainState, setDomainState] = useState("all");
  const [sort, setSort] = useState("newest");
  const filtered = useMemo(() => apps.filter((app) => {
    const matchesQuery = `${app.name} ${app.display_name} ${(app.domains || []).join(" ")}`.toLowerCase().includes(query.toLowerCase());
    const matchesDomain = domainState === "all" || (domainState === "connected" ? app.domains?.length : !app.domains?.length);
    return matchesQuery && matchesDomain && (status === "all" || app.status === status) && (type === "all" || app.app_type === type);
  }).sort((a, b) => {
    if (sort === "name") return a.display_name.localeCompare(b.display_name, "fa");
    if (sort === "usage") return (b.runtime?.memory_used || 0) - (a.runtime?.memory_used || 0);
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  }), [apps, query, status, type, domainState, sort]);

  function ResourceRing({ label, value, caption, percent }: { label: string; value: string; caption: string; percent: number }) {
    const safe = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
    return (
      <div className="service-resource">
        <div className="service-resource__ring" style={{ "--usage": `${safe * 3.6}deg` } as React.CSSProperties}>
          <div><strong dir="ltr">{value}</strong><small dir="ltr">{caption}</small></div>
        </div>
        <span>{label}</span>
      </div>
    );
  }

  return (
    <>
      <section className="services-heading">
        <div><span className="eyebrow"><Layers3 /> مرکز سرویس‌ها</span><h2>سرویس‌های شما</h2><p>منابع، دامنه‌ها، فایل‌ها و وضعیت اجرای همهٔ برنامه‌ها در یک نما</p></div>
        <button className="button button--primary button--large" onClick={onCreate}><Plus /> ایجاد سرویس جدید</button>
      </section>
      <section className="service-filters panel">
        <label className="toolbar__search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی سرویس یا دامنه..." /></label>
        <label><select value={type} onChange={(event) => setType(event.target.value)}><option value="all">همهٔ پلتفرم‌ها</option>{appTypes.map((item) => <option key={item} value={item}>{typeLabels[item]}</option>)}</select></label>
        <label><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">همهٔ وضعیت‌ها</option><option value="running">روشن</option><option value="stopped">متوقف</option><option value="failed">دارای خطا</option><option value="deploying">در حال دیپلوی</option></select></label>
        <label><select value={domainState} onChange={(event) => setDomainState(event.target.value)}><option value="all">همهٔ دامنه‌ها</option><option value="connected">دامنه متصل</option><option value="empty">بدون دامنه</option></select></label>
        <label><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">جدیدترین</option><option value="name">مرتب‌سازی نام</option><option value="usage">بیشترین مصرف RAM</option></select></label>
        <button className="button button--soft"><Filter /> فیلتر <b>{fa(filtered.length, 0)}</b></button>
      </section>
      {filtered.length ? (
        <section className="service-stack">
          {filtered.map((app) => (
            <article className="service-card" key={app.id} onClick={() => navigate(`app/${app.id}`)}>
              <div className="service-card__state"><StatusBadge status={app.status} pulse={app.status === "running"} /></div>
              <div className="service-card__identity">
                <AppGlyph type={app.app_type} size="lg" />
                <div><h3>{app.display_name}</h3><p dir="ltr">{app.name}</p><small>{typeLabels[app.app_type]}</small></div>
              </div>
              <div className="service-card__resources">
                <ResourceRing label="مصرف CPU" value={`${fa(app.runtime?.cpu_percent || 0, 1)}%`} caption="لحظه‌ای" percent={app.runtime?.cpu_percent || 0} />
                <ResourceRing label="مصرف RAM" value={bytes(app.runtime?.memory_used || 0)} caption={app.runtime?.memory_limit ? `از ${bytes(app.runtime.memory_limit)}` : "بدون محدودیت"} percent={app.runtime?.memory_percent || 0} />
                <ResourceRing label="Disk I/O" value={bytes((app.runtime?.block_read || 0) + (app.runtime?.block_write || 0))} caption={`سورس ${bytes(app.source_size)}`} percent={Math.min(100, app.source_size / (5 * 1024 ** 3) * 100)} />
              </div>
              <div className="service-card__endpoint">
                <span><Globe2 /></span>
                <div><small>{app.domains?.length ? `${fa(app.domains.length, 0)} دامنه متصل` : "آدرس داخلی"}</small><strong dir="ltr">{app.domains?.[0] || `127.0.0.1:${app.host_port}`}</strong></div>
              </div>
              <div className="service-card__action">
                <button className="button button--soft" onClick={(event) => { event.stopPropagation(); navigate(`app/${app.id}`); }}>مشاهده جزئیات <ArrowUpLeft /></button>
                <small><Clock3 /> به‌روزرسانی {ago(app.updated_at)}</small>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="panel"><EmptyState title="سرویسی پیدا نشد" text={apps.length ? "فیلتر یا عبارت جست‌وجو را تغییر دهید." : "اولین سرویس را بسازید و سورس خود را آپلود کنید."} action={!apps.length && <button className="button button--primary" onClick={onCreate}><Plus /> ساخت اولین سرویس</button>} /></section>
      )}
    </>
  );
}
