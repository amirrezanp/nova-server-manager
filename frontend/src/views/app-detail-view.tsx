"use client";

import {
  Activity, ArchiveRestore, ArrowRight, CheckCircle2, CircleStop, Clock3, Code2,
  Copy, DatabaseBackup, Download, ExternalLink, File, FileArchive, FileCode2,
  Folder, Globe2, HardDrive, History, LoaderCircle, MoreHorizontal, PackageCheck,
  Play, Plus, RefreshCcw, Rocket, RotateCw, Save, Settings2, SquareTerminal,
  Trash2, UploadCloud, X, Zap,
} from "@/lib/icons";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { Deployment, FileItem, NovaApp, UploadProgress, UploadRecord } from "@/lib/types";
import { ago, bytes, dateTime, duration, fa, stageLabels, typeLabels } from "@/lib/format";
import { api, uploadSource } from "@/lib/api";
import { AppGlyph, EmptyState, Field, Modal, ProgressBar, StatusBadge } from "@/components/ui";

type Tab = "overview" | "source" | "deployments" | "logs" | "domain" | "settings";
const tabs: Array<[Tab, string, typeof Activity]> = [
  ["overview", "نمای کلی", Activity],
  ["source", "سورس و فایل‌ها", FileCode2],
  ["deployments", "دیپلوی‌ها", Rocket],
  ["logs", "لاگ و کنسول", SquareTerminal],
  ["domain", "دامنه و SSL", Globe2],
  ["settings", "تنظیمات", Settings2],
];

function UploadModal({
  app, close, completed, notify, maxUpload,
}: {
  app: NovaApp; close: () => void; completed: () => void;
  notify: (message: string, kind?: "success" | "error" | "info") => void;
  maxUpload: number;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [result, setResult] = useState<{ upload: UploadRecord; source: { files: number; size: number } } | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function select(selected?: File) {
    setError(""); setResult(null); setProgress(null);
    if (!selected) return setFile(null);
    if (!selected.name.toLowerCase().endsWith(".zip")) return setError("فقط فایل ZIP قابل آپلود است.");
    if (selected.size > maxUpload) return setError(`حجم فایل از سقف ${bytes(maxUpload)} بیشتر است.`);
    setFile(selected);
  }

  async function start() {
    if (!file) return;
    setError("");
    try {
      const response = await uploadSource<{ upload: UploadRecord; source: { files: number; size: number } }>(app.id, file, setProgress);
      setResult(response); completed(); notify("آپلود و استخراج سورس با موفقیت تکمیل شد");
    } catch (exception) {
      setProgress((current) => current ? { ...current, phase: "failed" } : null);
      setError(exception instanceof Error ? exception.message : "آپلود ناموفق بود");
      notify("آپلود فایل ناموفق بود", "error");
    }
  }

  return (
    <Modal title="آپلود نسخه جدید" subtitle={`سورس جدید برای ${app.display_name}`} onClose={close} wide>
      {!progress && !result && (
        <>
          <div
            className={`dropzone dropzone--large ${dragging ? "dropzone--dragging" : ""} ${file ? "dropzone--selected" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); select(event.dataTransfer.files[0]); }}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".zip" onChange={(event) => select(event.target.files?.[0])} hidden />
            <span><UploadCloud /></span>
            {file ? (
              <><h3>{file.name}</h3><p>{bytes(file.size)} از سقف {bytes(maxUpload)}</p><div className="file-ready"><CheckCircle2 /> فایل آمادهٔ آپلود است</div></>
            ) : (
              <><h3>فایل ZIP پروژه را بکشید و رها کنید</h3><p>یا برای انتخاب فایل از کامپیوتر کلیک کنید</p><small>حداکثر حجم مجاز: {bytes(maxUpload)}</small></>
            )}
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="upload-note"><ArchiveRestore /><p><strong>فرآیند امن جایگزینی</strong><span>سورس فعلی تا پایان بررسی ZIP نگه‌داری می‌شود و فقط پس از استخراج موفق جایگزین خواهد شد.</span></p></div>
          <div className="modal__actions"><button className="button button--ghost" onClick={close}>انصراف</button><button className="button button--primary" disabled={!file} onClick={start}><UploadCloud /> شروع آپلود</button></div>
        </>
      )}

      {progress && !result && (
        <div className="upload-live">
          <div className={`upload-live__visual upload-live__visual--${progress.phase}`}>
            {progress.phase === "failed" ? <X /> : progress.phase === "processing" ? <LoaderCircle className="spin" /> : <UploadCloud />}
          </div>
          <h3>{progress.phase === "uploading" ? "در حال آپلود فایل" : progress.phase === "processing" ? "در حال بررسی و استخراج" : "آپلود متوقف شد"}</h3>
          <p>{file?.name}</p>
          <div className="upload-live__percent"><strong>{fa(progress.percent, 0)}٪</strong><span>{bytes(progress.loaded)} از {bytes(progress.total)}</span></div>
          <ProgressBar value={progress.percent} tone={progress.phase === "failed" ? "danger" : "primary"} />
          <div className="upload-live__metrics">
            <span><b>{progress.speed ? `${bytes(progress.speed)}/s` : "—"}</b><small>سرعت ارسال</small></span>
            <span><b>{bytes(progress.remaining)}</b><small>حجم باقی‌مانده</small></span>
            <span><b>{progress.eta ? `${fa(Math.ceil(progress.eta), 0)} ثانیه` : progress.phase === "processing" ? "در حال پردازش" : "—"}</b><small>زمان تقریبی</small></span>
          </div>
          {progress.phase === "processing" && <div className="processing-hint"><LoaderCircle className="spin" /> ارتباط را نبندید؛ فایل روی سرور در حال اعتبارسنجی و Extract است.</div>}
          {error && <><div className="form-error">{error}</div><button className="button button--ghost" onClick={() => setProgress(null)}>تلاش دوباره</button></>}
        </div>
      )}

      {result && (
        <div className="upload-result">
          <span className="upload-result__check"><PackageCheck /></span>
          <h3>نسخه جدید آماده است</h3>
          <p>فایل با موفقیت ارسال، اعتبارسنجی و استخراج شد.</p>
          <div className="result-grid">
            <div><FileArchive /><span>فایل آپلودشده</span><strong>{result.upload.filename}</strong></div>
            <div><HardDrive /><span>حجم فایل ZIP</span><strong>{bytes(result.upload.size)}</strong></div>
            <div><FileCode2 /><span>فایل استخراج‌شده</span><strong>{fa(result.source.files, 0)} فایل</strong></div>
            <div><Folder /><span>حجم نهایی سورس</span><strong>{bytes(result.source.size)}</strong></div>
          </div>
          <div className="upload-result__next"><Rocket /><div><strong>مرحله بعد</strong><p>برای اعمال نسخه جدید روی «شروع دیپلوی» کلیک کنید.</p></div></div>
          <div className="modal__actions"><button className="button button--primary" onClick={close}>مشاهده سورس</button></div>
        </div>
      )}
    </Modal>
  );
}

function OverviewTab({
  app, uploads, deployments, stats, onUpload, onDeploy, onBackup,
}: {
  app: NovaApp; uploads: UploadRecord[]; deployments: Deployment[];
  stats: Record<string, string>; onUpload: () => void; onDeploy: () => void; onBackup: () => void;
}) {
  const lastUpload = uploads[0];
  const lastDeploy = deployments[0];
  return (
    <div className="app-overview">
      <section className="overview-main">
        <article className="panel">
          <header className="panel__head"><div><h3>وضعیت سرویس</h3><p>اطلاعات عملیاتی کانتینر</p></div><StatusBadge status={app.status} pulse={app.status === "running"} /></header>
          <div className="runtime-grid">
            <div><span>CPU مصرفی</span><strong>{stats.cpu || "0%"}</strong><small>لحظه‌ای</small></div>
            <div><span>حافظه کانتینر</span><strong>{stats.memory || "0 B"}</strong><small>مصرف / محدودیت</small></div>
            <div><span>ترافیک شبکه</span><strong>{stats.network || "0 B"}</strong><small>ورودی / خروجی</small></div>
            <div><span>Disk I/O</span><strong>{stats.block || "0 B"}</strong><small>خواندن / نوشتن</small></div>
          </div>
        </article>

        <article className="panel">
          <header className="panel__head"><div><h3>آخرین نسخه سورس</h3><p>وضعیت فایل‌های آماده دیپلوی</p></div><button className="text-button" onClick={onUpload}><UploadCloud /> نسخه جدید</button></header>
          {lastUpload ? (
            <div className="artifact">
              <span className="artifact__icon"><FileArchive /></span>
              <div className="artifact__main"><strong>{lastUpload.filename}</strong><p>{fa(lastUpload.files_extracted, 0)} فایل استخراج‌شده · {bytes(lastUpload.extracted_size)}</p><small>آپلود {ago(lastUpload.completed_at || lastUpload.created_at)}</small></div>
              <div className="artifact__size"><b>{bytes(lastUpload.size)}</b><StatusBadge status={lastUpload.status} /></div>
            </div>
          ) : <EmptyState title="هنوز سورسی آپلود نشده" text="فایل ZIP پروژه را اضافه کنید تا برای دیپلوی آماده شود." action={<button className="button button--primary" onClick={onUpload}><UploadCloud /> آپلود سورس</button>} />}
        </article>

        <article className="panel">
          <header className="panel__head"><div><h3>آخرین دیپلوی</h3><p>وضعیت انتشار آخرین نسخه</p></div><button className="text-button" onClick={onDeploy}><Rocket /> دیپلوی جدید</button></header>
          {lastDeploy ? (
            <div className="deployment-summary">
              <div className="deployment-summary__line"><span><History /></span><div><strong>Deployment #{lastDeploy.id}</strong><p>{stageLabels[lastDeploy.stage] || lastDeploy.stage} · {ago(lastDeploy.created_at)}</p></div><StatusBadge status={lastDeploy.status} /></div>
              <ProgressBar value={lastDeploy.progress} tone={lastDeploy.status === "failed" ? "danger" : lastDeploy.status === "completed" ? "success" : "primary"} />
              <footer><span>Image: <b dir="ltr">{lastDeploy.image || app.image || "—"}</b></span><span>مدت: <b>{duration(lastDeploy.duration_seconds)}</b></span></footer>
            </div>
          ) : <EmptyState title="دیپلویی ثبت نشده" text="بعد از آپلود سورس، اولین دیپلوی را شروع کنید." />}
        </article>
      </section>
      <aside className="overview-side">
        <article className="panel quick-actions">
          <header className="panel__head"><h3>عملیات سریع</h3></header>
          <button onClick={onUpload}><span><UploadCloud /></span><div><strong>آپلود نسخه جدید</strong><small>جایگزینی امن سورس</small></div></button>
          <button onClick={onDeploy}><span><Rocket /></span><div><strong>شروع دیپلوی</strong><small>Build و انتشار کانتینر</small></div></button>
          <button onClick={onBackup}><span><DatabaseBackup /></span><div><strong>دریافت بکاپ</strong><small>ذخیره روی همین سرور</small></div></button>
        </article>
        <article className="panel details-list">
          <header className="panel__head"><h3>مشخصات فنی</h3></header>
          <dl><div><dt>Container</dt><dd dir="ltr">{app.container_name}</dd></div><div><dt>Internal address</dt><dd dir="ltr">127.0.0.1:{app.host_port}</dd></div><div><dt>Application port</dt><dd>{app.internal_port}</dd></div><div><dt>Source files</dt><dd>{fa(app.source_files, 0)}</dd></div><div><dt>Source size</dt><dd>{bytes(app.source_size)}</dd></div></dl>
        </article>
      </aside>
    </div>
  );
}

function SourceTab({
  app, uploads, notify,
}: { app: NovaApp; uploads: UploadRecord[]; notify: (text: string, kind?: "success" | "error" | "info") => void }) {
  const [path, setPath] = useState("");
  const [items, setItems] = useState<FileItem[]>([]);
  const [editor, setEditor] = useState<{ path: string; content: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (nextPath = path) => {
    setLoading(true);
    try {
      const result = await api<{ path: string; items: FileItem[] }>(`/api/apps/${app.id}/files?path=${encodeURIComponent(nextPath)}`);
      setPath(nextPath); setItems(result.items); setEditor(null);
    } catch (error) { notify(error instanceof Error ? error.message : "دریافت فایل‌ها ناموفق بود", "error"); }
    finally { setLoading(false); }
  }, [app.id, notify, path]);

  useEffect(() => { void load(""); }, [app.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function open(item: FileItem) {
    if (item.directory) return load(item.path);
    try {
      const data = await api<{ path: string; content: string }>(`/api/apps/${app.id}/files/content?path=${encodeURIComponent(item.path)}`);
      setEditor(data);
    } catch (error) { notify(error instanceof Error ? error.message : "فایل قابل ویرایش نیست", "error"); }
  }
  async function save() {
    if (!editor) return;
    try {
      await api(`/api/apps/${app.id}/files/content`, { method: "PUT", body: editor as never });
      notify("فایل ذخیره شد");
    } catch (error) { notify(error instanceof Error ? error.message : "ذخیره ناموفق بود", "error"); }
  }
  async function remove(item: FileItem) {
    if (!confirm(`«${item.path}» حذف شود؟`)) return;
    try { await api(`/api/apps/${app.id}/files?path=${encodeURIComponent(item.path)}`, { method: "DELETE" }); await load(); notify("فایل حذف شد"); }
    catch (error) { notify(error instanceof Error ? error.message : "حذف ناموفق بود", "error"); }
  }
  async function create(directory: boolean) {
    const name = prompt(directory ? "نام پوشه جدید" : "نام فایل جدید");
    if (!name || name.includes("/") || name.includes("\\")) return;
    try {
      await api(`/api/apps/${app.id}/files`, { method: "POST", body: { path: [path, name].filter(Boolean).join("/"), directory } as never });
      await load(); notify(directory ? "پوشه ساخته شد" : "فایل ساخته شد");
    } catch (error) { notify(error instanceof Error ? error.message : "ساخت ناموفق بود", "error"); }
  }

  return (
    <div className="source-layout">
      <section className="panel file-browser">
        <header className="file-browser__head"><div><h3>فایل‌های پروژه</h3><p dir="ltr">/{path}</p></div><div><button className="icon-button" onClick={() => create(false)} title="فایل جدید"><File /></button><button className="icon-button" onClick={() => create(true)} title="پوشه جدید"><Folder /></button><button className="icon-button" onClick={() => load()}><RefreshCcw /></button></div></header>
        {path && <button className="file-row file-row--parent" onClick={() => load(path.split("/").slice(0, -1).join("/"))}><ArrowRight /><span>پوشه بالاتر</span></button>}
        <div className="file-list">
          {loading ? <div className="inline-loader"><LoaderCircle className="spin" /> در حال خواندن...</div> : items.map((item) => (
            <div className="file-row" key={item.path}>
              <button className="file-row__open" onClick={() => open(item)}>{item.directory ? <Folder /> : <FileCode2 />}<span><strong>{item.name}</strong><small>{item.directory ? "پوشه" : bytes(item.size)}</small></span></button>
              <button className="file-row__delete" onClick={() => remove(item)}><Trash2 /></button>
            </div>
          ))}
          {!loading && !items.length && <EmptyState title="پوشه خالی است" text="فایل یا پوشه جدید بسازید." />}
        </div>
      </section>
      <section className="panel code-editor">
        {editor ? <><header><div><Code2 /><span dir="ltr">{editor.path}</span></div><button className="button button--primary button--small" onClick={save}><Save /> ذخیره فایل</button></header><textarea dir="ltr" spellCheck={false} value={editor.content} onChange={(event) => setEditor({ ...editor, content: event.target.value })} /></> : <EmptyState title="ویرایشگر آماده است" text="یک فایل متنی را از فهرست انتخاب کنید." />}
      </section>
      <section className="panel upload-history-panel">
        <header className="panel__head"><div><h3>تاریخچه آپلود</h3><p>نسخه‌های دریافت‌شده از پنل</p></div></header>
        <div className="compact-history">{uploads.map((upload) => <div key={upload.id}><span><FileArchive /></span><p><strong>{upload.filename}</strong><small>{dateTime(upload.created_at)} · {fa(upload.files_extracted, 0)} فایل</small></p><b>{bytes(upload.size)}</b><StatusBadge status={upload.status} /></div>)}{!uploads.length && <EmptyState title="آپلودی ثبت نشده" text="پس از اولین آپلود، جزئیات اینجا باقی می‌ماند." />}</div>
      </section>
    </div>
  );
}

function DeploymentsTab({ deployments, app, deploy }: { deployments: Deployment[]; app: NovaApp; deploy: () => void }) {
  return (
    <section className="panel">
      <header className="panel__head"><div><h3>تاریخچه دیپلوی</h3><p>تمام Buildها و انتشارهای {app.display_name}</p></div><button className="button button--primary" onClick={deploy}><Rocket /> دیپلوی جدید</button></header>
      <div className="deployment-list">
        {deployments.map((item) => (
          <article key={item.id} className="deployment-row">
            <span className={`deployment-row__icon deployment-row__icon--${item.status}`}>{item.status === "completed" ? <CheckCircle2 /> : item.status === "failed" ? <X /> : <LoaderCircle className="spin" />}</span>
            <div className="deployment-row__main"><div><strong>Deployment #{item.id}</strong><StatusBadge status={item.status} /></div><p>{stageLabels[item.stage] || item.stage}</p>{["running", "queued"].includes(item.status) && <ProgressBar value={item.progress} />}</div>
            <div className="deployment-row__meta"><span><Clock3 /> {dateTime(item.created_at)}</span><span>مدت اجرا: {duration(item.duration_seconds)}</span><small dir="ltr">{item.image || app.image || "No image yet"}</small></div>
          </article>
        ))}
        {!deployments.length && <EmptyState title="هنوز دیپلویی انجام نشده" text="یک سورس آپلود کنید و اولین انتشار را شروع کنید." />}
      </div>
    </section>
  );
}

function LogsTab({ app, notify }: { app: NovaApp; notify: (text: string, kind?: "success" | "error" | "info") => void }) {
  const [logs, setLogs] = useState("");
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState("$ کنسول داخل کانتینر آماده است.\n");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setLogs((await api<{ logs: string }>(`/api/apps/${app.id}/logs?tail=600`)).logs); }
    catch (error) { notify(error instanceof Error ? error.message : "دریافت لاگ ناموفق بود", "error"); }
  }, [app.id, notify]);
  useEffect(() => { void load(); }, [load]);
  async function execute(event: FormEvent) {
    event.preventDefault(); if (!command.trim()) return;
    const current = command; setCommand(""); setBusy(true); setOutput((value) => `${value}$ ${current}\n`);
    try {
      const result = await api<{ output: string; exit_code: number }>(`/api/apps/${app.id}/exec`, { method: "POST", body: { command: current } as never });
      setOutput((value) => `${value}${result.output || `(exit ${result.exit_code})`}\n`);
    } catch (error) { setOutput((value) => `${value}Error: ${error instanceof Error ? error.message : "unknown"}\n`); }
    finally { setBusy(false); }
  }
  return (
    <div className="terminal-grid">
      <section className="terminal">
        <header><div><i /><i /><i /><strong>Container logs</strong></div><button onClick={load}><RefreshCcw /> تازه‌سازی</button></header>
        <pre>{logs || "هنوز لاگی برای این کانتینر ثبت نشده است."}</pre>
      </section>
      <section className="terminal">
        <header><div><i /><i /><i /><strong>Container shell</strong></div><span>sh</span></header>
        <pre>{output}</pre>
        <form onSubmit={execute}><b>$</b><input dir="ltr" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="ls -la" autoComplete="off" /><button disabled={busy}>اجرا</button></form>
      </section>
    </div>
  );
}

function DomainTab({ app, notify, reload }: { app: NovaApp; notify: (text: string, kind?: "success" | "error" | "info") => void; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await api(`/api/apps/${app.id}/domain`, { method: "POST", body: { domain: form.get("domain"), enable_ssl: form.get("ssl") === "on" } as never });
      notify("دامنه و Reverse Proxy با موفقیت تنظیم شد"); reload();
    } catch (error) { notify(error instanceof Error ? error.message : "تنظیم دامنه ناموفق بود", "error"); }
    finally { setBusy(false); }
  }
  return (
    <div className="two-columns">
      <section className="panel">
        <header className="panel__head"><div><h3>اتصال دامنه</h3><p>Nginx Reverse Proxy و گواهی SSL</p></div><Globe2 /></header>
        <div className="info-banner"><Zap /><p><strong>قبل از ادامه</strong><span>رکورد A دامنه باید به IP همین سرور اشاره کند.</span></p></div>
        <form className="form" onSubmit={submit}><Field label="نام دامنه"><input name="domain" dir="ltr" defaultValue={app.domain} placeholder="app.example.com" required /></Field><label className="switch-field"><input name="ssl" type="checkbox" defaultChecked /><i /><span><strong>فعال‌سازی HTTPS</strong><small>دریافت خودکار Let’s Encrypt و Redirect</small></span></label><button className="button button--primary" disabled={busy}>{busy ? "در حال تنظیم..." : "اتصال دامنه"} <Globe2 /></button></form>
      </section>
      <section className="panel traffic-flow">
        <header className="panel__head"><h3>مسیر ترافیک</h3></header>
        <div><span><Globe2 /></span><p><small>Public endpoint</small><strong dir="ltr">{app.domain ? `https://${app.domain}` : "تنظیم نشده"}</strong></p></div><i /><div><span><RefreshCcw /></span><p><small>Nginx proxy</small><strong>Port 80 / 443</strong></p></div><i /><div><span><BoxesIcon /></span><p><small>Application</small><strong dir="ltr">127.0.0.1:{app.host_port}</strong></p></div>
      </section>
    </div>
  );
}

function BoxesIcon() { return <PackageCheck />; }

function SettingsTab({ app, notify, reload, navigate }: { app: NovaApp; notify: (text: string, kind?: "success" | "error" | "info") => void; reload: () => void; navigate: (route: string) => void }) {
  const envText = Object.entries(app.environment || {}).map(([key, value]) => `${key}=${value}`).join("\n");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const environment: Record<string, string> = {};
    String(form.get("environment") || "").split("\n").forEach((line) => { const index = line.indexOf("="); if (index > 0) environment[line.slice(0, index).trim()] = line.slice(index + 1).trim(); });
    try {
      await api(`/api/apps/${app.id}`, { method: "PATCH", body: { display_name: form.get("display_name"), internal_port: Number(form.get("internal_port")), start_command: form.get("start_command"), environment } as never });
      notify("تنظیمات ذخیره شد؛ برای اعمال دوباره دیپلوی کنید."); reload();
    } catch (error) { notify(error instanceof Error ? error.message : "ذخیره ناموفق بود", "error"); }
  }
  async function remove() {
    if (!confirm("برنامه و کانتینر حذف شود؟")) return;
    const deleteData = confirm("سورس و volume دیتابیس نیز برای همیشه حذف شود؟");
    try { await api(`/api/apps/${app.id}?delete_data=${deleteData}`, { method: "DELETE" }); notify("برنامه حذف شد"); navigate("apps"); }
    catch (error) { notify(error instanceof Error ? error.message : "حذف ناموفق بود", "error"); }
  }
  return (
    <div className="two-columns two-columns--settings">
      <section className="panel"><header className="panel__head"><div><h3>تنظیمات اجرا</h3><p>متغیرها و فرمان اجرای برنامه</p></div></header><form className="form" onSubmit={save}><div className="form-grid"><Field label="نام نمایشی"><input name="display_name" defaultValue={app.display_name} /></Field><Field label="پورت داخلی"><input name="internal_port" dir="ltr" type="number" defaultValue={app.internal_port} /></Field></div><Field label="دستور اجرا"><input name="start_command" dir="ltr" defaultValue={app.start_command} /></Field><Field label="متغیرهای محیطی"><textarea name="environment" dir="ltr" rows={10} defaultValue={envText} /></Field><button className="button button--primary"><Save /> ذخیره تغییرات</button></form></section>
      <section className="panel danger-panel"><header className="panel__head"><div><h3>منطقه خطر</h3><p>عملیات غیرقابل بازگشت</p></div></header><div><Trash2 /><h4>حذف برنامه</h4><p>کانتینر و تنظیم دامنه حذف می‌شود. هنگام تأیید می‌توانید سورس و دیتای دائمی را نیز پاک کنید.</p><button className="button button--danger" onClick={remove}><Trash2 /> حذف کامل برنامه</button></div></section>
    </div>
  );
}

export default function AppDetailView({
  appId, maxUpload, navigate, notify, refreshApps,
}: {
  appId: number; maxUpload: number; navigate: (route: string) => void;
  notify: (text: string, kind?: "success" | "error" | "info") => void;
  refreshApps: () => Promise<void>;
}) {
  const [app, setApp] = useState<NovaApp | null>(null);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [stats, setStats] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>("overview");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [appData, uploadData, deploymentData, statsData] = await Promise.all([
      api<NovaApp>(`/api/apps/${appId}`),
      api<UploadRecord[]>(`/api/apps/${appId}/uploads`),
      api<Deployment[]>(`/api/apps/${appId}/deployments`),
      api<Record<string, string>>(`/api/apps/${appId}/stats`),
    ]);
    setApp(appData); setUploads(uploadData); setDeployments(deploymentData); setStats(statsData);
  }, [appId]);
  useEffect(() => { void load().catch((error) => notify(error instanceof Error ? error.message : "برنامه پیدا نشد", "error")); }, [load, notify]);
  useEffect(() => {
    if (!deployments.some((item) => ["queued", "running"].includes(item.status))) return;
    const timer = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(timer);
  }, [deployments, load]);

  async function action(operation: "start" | "stop" | "restart") {
    setBusy(true);
    try { await api(`/api/apps/${appId}/actions/${operation}`, { method: "POST" }); notify("عملیات با موفقیت انجام شد"); await load(); await refreshApps(); }
    catch (error) { notify(error instanceof Error ? error.message : "عملیات ناموفق بود", "error"); }
    finally { setBusy(false); }
  }
  async function deploy() {
    if (!app?.source_files && !["postgres", "mongodb", "docker"].includes(app?.app_type || "")) return notify("ابتدا فایل سورس را آپلود کنید", "error");
    setBusy(true);
    try { await api(`/api/apps/${appId}/deploy`, { method: "POST" }); notify("دیپلوی در پس‌زمینه آغاز شد"); setTab("deployments"); await load(); await refreshApps(); }
    catch (error) { notify(error instanceof Error ? error.message : "شروع دیپلوی ناموفق بود", "error"); }
    finally { setBusy(false); }
  }
  async function backup() {
    try { await api(`/api/backups/apps/${appId}`, { method: "POST", body: { destination: "local" } as never }); notify("ساخت بکاپ در پس‌زمینه آغاز شد"); }
    catch (error) { notify(error instanceof Error ? error.message : "بکاپ ناموفق بود", "error"); }
  }

  if (!app) return <div className="page-loader"><LoaderCircle className="spin" /><span>در حال بارگذاری برنامه...</span></div>;
  return (
    <>
      <button className="back-button" onClick={() => navigate("apps")}><ArrowRight /> بازگشت به برنامه‌ها</button>
      <section className="app-hero">
        <AppGlyph type={app.app_type} size="lg" />
        <div className="app-hero__title"><div><h2>{app.display_name}</h2><StatusBadge status={app.status} pulse={app.status === "running"} /></div><p><span>{typeLabels[app.app_type]}</span><i /> <code>{app.name}</code><i /> <span dir="ltr">{app.domain || `127.0.0.1:${app.host_port}`}</span></p></div>
        <div className="app-hero__actions">
          {app.domain && <a className="icon-button" href={`https://${app.domain}`} target="_blank"><ExternalLink /></a>}
          <button className="button button--ghost" disabled={busy} onClick={() => action("restart")}><RotateCw /> ری‌استارت</button>
          <button className="button button--ghost" disabled={busy} onClick={() => action(app.status === "running" ? "stop" : "start")}>{app.status === "running" ? <CircleStop /> : <Play />} {app.status === "running" ? "توقف" : "شروع"}</button>
          <button className="button button--primary" disabled={busy} onClick={deploy}><Rocket /> دیپلوی</button>
          <button className="icon-button"><MoreHorizontal /></button>
        </div>
      </section>
      {app.last_error && <div className="error-banner"><X /><div><strong>آخرین عملیات ناموفق بود</strong><p>{app.last_error}</p></div></div>}
      <nav className="tabs">{tabs.map(([value, label, Icon]) => <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}><Icon /> {label}</button>)}</nav>
      {tab === "overview" && <OverviewTab app={app} uploads={uploads} deployments={deployments} stats={stats} onUpload={() => setUploadOpen(true)} onDeploy={deploy} onBackup={backup} />}
      {tab === "source" && <SourceTab app={app} uploads={uploads} notify={notify} />}
      {tab === "deployments" && <DeploymentsTab deployments={deployments} app={app} deploy={deploy} />}
      {tab === "logs" && <LogsTab app={app} notify={notify} />}
      {tab === "domain" && <DomainTab app={app} notify={notify} reload={load} />}
      {tab === "settings" && <SettingsTab app={app} notify={notify} reload={load} navigate={navigate} />}
      {uploadOpen && <UploadModal app={app} maxUpload={maxUpload} close={() => setUploadOpen(false)} notify={notify} completed={async () => { await load(); await refreshApps(); }} />}
    </>
  );
}
