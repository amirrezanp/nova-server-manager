"use client";

import {
  Activity, ArchiveRestore, ArrowLineUp, ArrowRight, ArrowUpLeft, ArrowsOut, CheckCircle2, CircleStop, Clock3, Code2,
  Cloud, Copy, Certificate, DatabaseBackup, Download, ExternalLink, Eye, EyeSlash, File, FileArchive, FileCode2,
  FileZip, Folder, FolderOpen, Globe2, GridFour, HardDrive, History, LinkSimple, ListBullets, LoaderCircle, MoreHorizontal, PackageCheck,
  PencilSimple, Play, Plus, RefreshCcw, Rocket, RotateCw, Save, Search, Settings2, SquareTerminal,
  Trash2, UploadCloud, X, Zap,
} from "@/lib/icons";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Deployment, FileItem, NovaApp, UploadProgress, UploadRecord } from "@/lib/types";
import { ago, bytes, dateTime, duration, fa, stageLabels, typeLabels } from "@/lib/format";
import { api, uploadSource } from "@/lib/api";
import { AppGlyph, EmptyState, Field, Modal, ProgressBar, StatusBadge } from "@/components/ui";
import NovaCodeEditor from "@/components/code-editor";

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
  app, uploads, deployments, stats, onUpload, onDeploy, onBackup, reload, notify,
}: {
  app: NovaApp; uploads: UploadRecord[]; deployments: Deployment[];
  stats: Record<string, string>; onUpload: () => void; onDeploy: () => void; onBackup: () => void;
  reload: () => Promise<void>;
  notify: (message: string, kind?: "success" | "error" | "info") => void;
}) {
  const lastUpload = uploads[0];
  const lastDeploy = deployments[0];
  const [showPassword, setShowPassword] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  async function copyValue(value: string) {
    await navigator.clipboard.writeText(value);
    notify("در کلیپ‌بورد کپی شد");
  }
  async function toggleDatabaseAdmin(enabled: boolean) {
    setAdminBusy(true);
    try {
      await api(`/api/apps/${app.id}/database-admin`, {
        method: "POST",
        body: { enabled },
      });
      await reload();
      notify(enabled ? "پنل مدیریت دیتابیس فعال شد" : "پنل مدیریت دیتابیس غیرفعال شد");
    } catch (error) {
      notify(error instanceof Error ? error.message : "تغییر وضعیت پنل دیتابیس ناموفق بود", "error");
    } finally {
      setAdminBusy(false);
    }
  }
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

        {app.database && (
          <article className="panel database-console">
            <header className="panel__head"><div><h3>مشخصات اتصال دیتابیس</h3><p>اطلاعات دسترسی میزبان و شبکه خصوصی Docker</p></div><DatabaseBackup /></header>
            <div className="database-console__grid">
              <div><span>موتور دیتابیس</span><strong>{app.database.engine}</strong></div>
              <div><span>Host</span><strong dir="ltr">{app.database.host}</strong><button onClick={() => copyValue(app.database!.host)}><Copy /></button></div>
              <div><span>Public port</span><strong dir="ltr">{app.database.port}</strong><button onClick={() => copyValue(String(app.database!.port))}><Copy /></button></div>
              <div><span>Database</span><strong dir="ltr">{app.database.database}</strong><button onClick={() => copyValue(app.database!.database)}><Copy /></button></div>
              <div><span>Username</span><strong dir="ltr">{app.database.username}</strong><button onClick={() => copyValue(app.database!.username)}><Copy /></button></div>
              <div><span>Password</span><strong dir="ltr">{showPassword ? app.database.password : "••••••••••••••••"}</strong><button onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeSlash /> : <Eye />}</button><button onClick={() => copyValue(app.database!.password)}><Copy /></button></div>
              <div><span>Docker hostname</span><strong dir="ltr">{app.database.internal_host}</strong><button onClick={() => copyValue(app.database!.internal_host)}><Copy /></button></div>
              <div><span>Persistent volume</span><strong dir="ltr">{app.database.volume}</strong><button onClick={() => copyValue(app.database!.volume)}><Copy /></button></div>
            </div>
            <div className="connection-string">
              <div><span>Connection URI از روی سرور</span><code>{app.database.uri}</code></div>
              <button className="button button--soft" onClick={() => copyValue(app.database!.uri)}><Copy /> کپی URI</button>
            </div>
            <div className="connection-string">
              <div><span>Connection URI برای سایر کانتینرهای Nova</span><code>{app.database.internal_uri}</code></div>
              <button className="button button--soft" onClick={() => copyValue(app.database!.internal_uri)}><Copy /> کپی URI داخلی</button>
            </div>
            <div className="database-security"><Zap /><p><strong>اتصال امن</strong><small>پورت دیتابیس فقط روی 127.0.0.1 منتشر شده است. برای اتصال از سیستم شخصی از SSH Tunnel استفاده کنید.</small></p><code dir="ltr">ssh -L {app.database.port}:127.0.0.1:{app.database.port} root@SERVER_IP</code></div>
            <div className="database-sidecar">
              <div>
                <span><DatabaseBackup /></span>
                <p>
                  <strong>{app.database.engine === "PostgreSQL" ? "Adminer" : "Mongo Express"}</strong>
                  <small>پنل وب مدیریت دیتابیس، فقط از مسیر احراز هویت‌شده Nova در دسترس است.</small>
                </p>
              </div>
              <div className="database-sidecar__actions">
                {app.database.admin_enabled && (
                  <a className="button button--soft" href={app.database.admin_url} target="_blank" rel="noreferrer">
                    <ExternalLink /> باز کردن پنل
                  </a>
                )}
                <button
                  className={`button ${app.database.admin_enabled ? "button--danger" : "button--primary"}`}
                  disabled={adminBusy}
                  onClick={() => toggleDatabaseAdmin(!app.database!.admin_enabled)}
                >
                  {adminBusy ? <LoaderCircle className="spin" /> : <Cloud />}
                  {app.database.admin_enabled ? "غیرفعال‌سازی" : "فعال‌سازی پنل"}
                </button>
              </div>
            </div>
          </article>
        )}

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
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "size" | "modified">("name");
  const [view, setView] = useState<"list" | "grid">("list");
  const [history, setHistory] = useState([""]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const uploadRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (nextPath: string) => {
    setLoading(true);
    try {
      const result = await api<{ path: string; items: FileItem[] }>(`/api/apps/${app.id}/files?path=${encodeURIComponent(nextPath)}`);
      setPath(result.path); setItems(result.items); setSelected([]);
    } catch (error) { notify(error instanceof Error ? error.message : "دریافت فایل‌ها ناموفق بود", "error"); }
    finally { setLoading(false); }
  }, [app.id, notify]);

  useEffect(() => { void load(""); }, [app.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleItems = useMemo(() => items
    .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      if (a.directory !== b.directory) return a.directory ? -1 : 1;
      if (sort === "size") return b.size - a.size;
      if (sort === "modified") return b.modified - a.modified;
      return a.name.localeCompare(b.name);
    }), [items, query, sort]);

  async function navigatePath(nextPath: string) {
    await load(nextPath);
    const nextHistory = [...history.slice(0, historyIndex + 1), nextPath];
    setHistory(nextHistory); setHistoryIndex(nextHistory.length - 1);
  }
  async function travel(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= history.length) return;
    await load(history[nextIndex]); setHistoryIndex(nextIndex);
  }
  async function open(item: FileItem) {
    if (item.directory) return navigatePath(item.path);
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
  async function removeSelected() {
    if (!selected.length || !confirm(`${fa(selected.length, 0)} مورد انتخاب‌شده حذف شود؟`)) return;
    try {
      for (const item of selected) await api(`/api/apps/${app.id}/files?path=${encodeURIComponent(item)}`, { method: "DELETE" });
      await load(path); notify("موارد انتخاب‌شده حذف شدند");
    }
    catch (error) { notify(error instanceof Error ? error.message : "حذف ناموفق بود", "error"); }
  }
  async function create(directory: boolean) {
    const name = prompt(directory ? "نام پوشه جدید" : "نام فایل جدید");
    if (!name || name.includes("/") || name.includes("\\")) return;
    try {
      await api(`/api/apps/${app.id}/files`, { method: "POST", body: { path: [path, name].filter(Boolean).join("/"), directory } as never });
      await load(path); notify(directory ? "پوشه ساخته شد" : "فایل ساخته شد");
    } catch (error) { notify(error instanceof Error ? error.message : "ساخت ناموفق بود", "error"); }
  }
  async function renameOrMove(copy = false) {
    if (selected.length !== 1) return notify("برای این عملیات دقیقاً یک فایل یا پوشه را انتخاب کنید", "error");
    const source = selected[0];
    const destination = prompt(copy ? "مسیر کپی جدید" : "نام یا مسیر جدید", source);
    if (!destination || destination === source) return;
    try {
      await api(`/api/apps/${app.id}/files${copy ? "/copy" : ""}`, {
        method: copy ? "POST" : "PATCH",
        body: copy ? { source_path: source, destination_path: destination } : { old_path: source, new_path: destination } as never,
      });
      await load(path); notify(copy ? "کپی ساخته شد" : "فایل جابه‌جا/تغییرنام شد");
    } catch (error) { notify(error instanceof Error ? error.message : "عملیات ناموفق بود", "error"); }
  }
  async function compress() {
    if (!selected.length) return notify("حداقل یک مورد را انتخاب کنید", "error");
    const destination = prompt("نام فایل ZIP", [path, "archive.zip"].filter(Boolean).join("/"));
    if (!destination) return;
    try {
      await api(`/api/apps/${app.id}/files/compress`, { method: "POST", body: { paths: selected, destination_path: destination } as never });
      await load(path); notify("فایل ZIP ساخته شد");
    } catch (error) { notify(error instanceof Error ? error.message : "فشرده‌سازی ناموفق بود", "error"); }
  }
  async function extract() {
    const item = items.find((candidate) => selected[0] === candidate.path);
    if (selected.length !== 1 || item?.extension !== ".zip") return notify("یک فایل ZIP را انتخاب کنید", "error");
    try {
      await api(`/api/apps/${app.id}/files/extract`, { method: "POST", body: { archive_path: item.path, destination_path: path } as never });
      await load(path); notify("فایل ZIP استخراج شد");
    } catch (error) { notify(error instanceof Error ? error.message : "استخراج ناموفق بود", "error"); }
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    try {
      for (const file of Array.from(files)) {
        const form = new FormData(); form.append("file", file);
        await api(`/api/apps/${app.id}/files/upload?path=${encodeURIComponent(path)}`, { method: "POST", body: form });
      }
      await load(path); notify(`${fa(files.length, 0)} فایل آپلود شد`);
    } catch (error) { notify(error instanceof Error ? error.message : "آپلود فایل ناموفق بود", "error"); }
    finally { if (uploadRef.current) uploadRef.current.value = ""; }
  }
  function toggle(item: string) {
    setSelected((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  }
  function download() {
    if (selected.length !== 1) return notify("یک فایل را برای دانلود انتخاب کنید", "error");
    window.location.href = `/api/apps/${app.id}/files/download?path=${encodeURIComponent(selected[0])}`;
  }

  return (
    <div className="file-manager-workspace">
      <section className="panel file-manager">
        <header className="file-manager__title"><div><span><FolderOpen /></span><div><h3>مدیریت فایل‌های پروژه</h3><p>{fa(items.length, 0)} مورد در مسیر فعلی</p></div></div><code dir="ltr">/app/{path}</code></header>
        <div className="file-actions">
          <button onClick={() => create(false)}><Plus /> فایل</button>
          <button onClick={() => create(true)}><Plus /> پوشه</button>
          <button onClick={() => uploadRef.current?.click()}><UploadCloud /> آپلود</button>
          <input ref={uploadRef} type="file" multiple hidden onChange={(event) => void upload(event.target.files)} />
          <i />
          <button disabled={selected.length !== 1} onClick={download}><Download /> دانلود</button>
          <button disabled={selected.length !== 1} onClick={() => renameOrMove(true)}><Copy /> کپی</button>
          <button disabled={selected.length !== 1} onClick={() => renameOrMove(false)}><ArrowsOut /> انتقال</button>
          <button disabled={!selected.length} className="danger" onClick={removeSelected}><Trash2 /> حذف</button>
          <button disabled={selected.length !== 1} onClick={() => renameOrMove(false)}><PencilSimple /> تغییر نام</button>
          <button disabled={selected.length !== 1 || items.find((item) => item.path === selected[0])?.extension !== ".zip"} onClick={extract}><ArrowsOut /> Extract</button>
          <button disabled={!selected.length} onClick={compress}><FileZip /> Compress</button>
        </div>
        <div className="file-navigation">
          <button disabled={historyIndex === 0} onClick={() => travel(historyIndex - 1)}><ArrowRight /> برگشت</button>
          <button disabled={historyIndex >= history.length - 1} onClick={() => travel(historyIndex + 1)}>جلو <ArrowLineUp /></button>
          <button onClick={() => load(path)}><RefreshCcw /> تازه‌سازی</button>
          <div className="file-breadcrumb" dir="ltr"><button onClick={() => navigatePath("")}><FolderOpen /> Root</button>{path.split("/").filter(Boolean).map((part, index, parts) => <button key={`${part}-${index}`} onClick={() => navigatePath(parts.slice(0, index + 1).join("/"))}>/ {part}</button>)}</div>
        </div>
        <div className="file-table-tools">
          <div><button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><ListBullets /></button><button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}><GridFour /></button></div>
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="name">مرتب‌سازی نام</option><option value="size">حجم</option><option value="modified">آخرین تغییر</option></select>
          <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="فیلتر فایل‌ها..." /></label>
          <span>{fa(items.filter((item) => !item.directory).length, 0)} فایل · {fa(items.filter((item) => item.directory).length, 0)} پوشه · {bytes(items.reduce((sum, item) => sum + item.size, 0))}</span>
        </div>
        {path && <button className="file-parent-row" onClick={() => navigatePath(path.split("/").slice(0, -1).join("/"))}><ArrowRight /><FolderOpen /> پوشه بالاتر</button>}
        <div className={`file-table file-table--${view}`}>
          {view === "list" && <div className="file-table__head"><input type="checkbox" checked={!!visibleItems.length && selected.length === visibleItems.length} onChange={(event) => setSelected(event.target.checked ? visibleItems.map((item) => item.path) : [])} /><span>نام</span><span>حجم</span><span>دسترسی</span><span>آخرین تغییر</span><i /></div>}
          {loading ? <div className="inline-loader"><LoaderCircle className="spin" /> در حال خواندن فایل‌ها...</div> : visibleItems.map((item) => (
            <div className={`file-entry ${selected.includes(item.path) ? "selected" : ""}`} key={item.path}>
              <input type="checkbox" checked={selected.includes(item.path)} onChange={() => toggle(item.path)} />
              <button className="file-entry__name" onDoubleClick={() => open(item)} onClick={() => toggle(item.path)}>{item.directory ? <Folder /> : item.extension === ".zip" ? <FileZip /> : <FileCode2 />}<strong dir="ltr">{item.name}</strong></button>
              <span>{item.directory ? "—" : bytes(item.size)}</span>
              <code>{item.permissions}</code>
              <time>{new Date(item.modified * 1000).toLocaleString("fa-IR")}</time>
              <button onClick={() => open(item)}>{item.directory ? <ArrowUpLeft /> : <PencilSimple />}</button>
            </div>
          ))}
          {!loading && !visibleItems.length && <EmptyState title="فایلی پیدا نشد" text={query ? "عبارت جست‌وجو را تغییر دهید." : "فایل یا پوشه جدید بسازید."} />}
        </div>
      </section>
      <section className="panel upload-history-panel">
        <header className="panel__head"><div><h3>تاریخچه آپلود</h3><p>نسخه‌های دریافت‌شده از پنل</p></div></header>
        <div className="compact-history">{uploads.map((upload) => <div key={upload.id}><span><FileArchive /></span><p><strong>{upload.filename}</strong><small>{dateTime(upload.created_at)} · {fa(upload.files_extracted, 0)} فایل</small></p><b>{bytes(upload.size)}</b><StatusBadge status={upload.status} /></div>)}{!uploads.length && <EmptyState title="آپلودی ثبت نشده" text="پس از اولین آپلود، جزئیات اینجا باقی می‌ماند." />}</div>
      </section>
      {editor && <Modal title={editor.path.split("/").pop() || editor.path} subtitle={editor.path} onClose={() => setEditor(null)} wide><div className="nova-editor-toolbar"><span><Code2 /> Syntax highlighting · UTF-8</span><div><button className="button button--ghost" onClick={() => setEditor(null)}>بستن</button><button className="button button--primary" onClick={save}><Save /> ثبت تغییرات</button></div></div><div className="nova-code-editor" dir="ltr"><NovaCodeEditor path={editor.path} value={editor.content} onChange={(content) => setEditor({ ...editor, content })} /></div><footer className="nova-editor-status"><span>Ln / Col توسط ادیتور</span><span>UTF-8 · Spaces</span></footer></Modal>}
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

function DomainTab({ app, serverIp, notify, reload }: { app: NovaApp; serverIp: string; notify: (text: string, kind?: "success" | "error" | "info") => void; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"a" | "cname" | "wildcard">("cname");
  const [target, setTarget] = useState("server.example.com");
  const domains = app.domains || (app.domain ? [app.domain] : []);

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    notify("مقدار در کلیپ‌بورد کپی شد");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const form = new FormData(event.currentTarget);
    const wantsSsl = form.get("ssl") === "on";
    try {
      const result = await api<{ warning?: string }>(`/api/apps/${app.id}/domain`, { method: "POST", body: { domain: form.get("domain"), enable_ssl: wantsSsl, dns_mode: mode } as never });
      notify(result.warning ? "دامنه روی HTTP فعال شد؛ صدور SSL ناموفق بود و باید DNS بررسی شود." : wantsSsl ? "دامنه به Nginx اضافه و HTTPS فعال شد" : "دامنه روی HTTP فعال شد", result.warning ? "info" : "success"); reload();
    } catch (error) { notify(error instanceof Error ? error.message : "تنظیم دامنه ناموفق بود", "error"); }
    finally { setBusy(false); }
  }

  async function remove(domain: string) {
    if (!confirm(`دامنه ${domain} از این سرویس حذف شود؟`)) return;
    try {
      await api(`/api/apps/${app.id}/domain/${encodeURIComponent(domain)}`, { method: "DELETE" });
      notify("دامنه حذف شد"); reload();
    } catch (error) { notify(error instanceof Error ? error.message : "حذف دامنه ناموفق بود", "error"); }
  }

  const dnsValue = mode === "a" ? (serverIp || "SERVER_IP") : mode === "wildcard" ? (serverIp || "SERVER_IP") : target;
  const dnsName = mode === "wildcard" ? "*.apps" : "app";
  return (
    <div className="domain-workspace">
      <section className="panel domain-connect">
        <header className="panel__head"><div><h3>افزودن دامنه جدید</h3><p>هر تعداد دامنه را روی همین IP به سرویس متصل کنید</p></div><Globe2 /></header>
        <div className="dns-mode-grid">
          <button className={mode === "cname" ? "active" : ""} onClick={() => setMode("cname")}><LinkSimple /><strong>CNAME</strong><small>پیشنهادی برای چند سرویس</small></button>
          <button className={mode === "a" ? "active" : ""} onClick={() => setMode("a")}><Cloud /><strong>A Record</strong><small>اتصال مستقیم به IP</small></button>
          <button className={mode === "wildcard" ? "active" : ""} onClick={() => setMode("wildcard")}><Zap /><strong>Wildcard</strong><small>تمام زیردامنه‌ها با یک رکورد</small></button>
        </div>
        <div className="dns-recipe">
          <div><span>Type</span><strong dir="ltr">{mode === "wildcard" ? "A" : mode.toUpperCase()}</strong></div>
          <div><span>Name</span><strong dir="ltr">{dnsName}</strong></div>
          <div><span>Value / Target</span><strong dir="ltr">{dnsValue}</strong><button onClick={() => copy(dnsValue)}><Copy /></button></div>
        </div>
        {mode === "cname" && <Field label="hostname اصلی سرور" hint={`این hostname باید یک‌بار با رکورد A به ${serverIp || "IP سرور"} متصل شود.`}><input dir="ltr" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="server.example.com" /></Field>}
        <form className="form domain-form" onSubmit={submit}>
          <Field label="دامنه کامل سرویس"><input name="domain" dir="ltr" placeholder="api.example.com" required /></Field>
          <label className="switch-field"><input name="ssl" type="checkbox" defaultChecked /><i /><span><strong>فعال‌سازی HTTPS</strong><small>گواهی Let’s Encrypt و انتقال خودکار HTTP به HTTPS</small></span></label>
          <button className="button button--primary" disabled={busy}>{busy ? "در حال بررسی DNS و Nginx..." : "افزودن دامنه"} <Globe2 /></button>
        </form>
      </section>
      <section className="domain-side">
        <article className="panel">
          <header className="panel__head"><div><h3>دامنه‌های متصل</h3><p>{fa(domains.length, 0)} ورودی فعال برای این سرویس</p></div><Certificate /></header>
          <div className="domain-list">
            {domains.map((domain, index) => <div key={domain}><span><Globe2 /></span><p><strong dir="ltr">{domain}</strong><small>{index === 0 ? "دامنه اصلی" : "دامنه جایگزین"} · Nginx host routing</small></p><a href={`https://${domain}`} target="_blank"><ExternalLink /></a><button onClick={() => remove(domain)}><Trash2 /></button></div>)}
            {!domains.length && <EmptyState title="دامنه‌ای متصل نیست" text="یک رکورد DNS بسازید و دامنه را از فرم کناری اضافه کنید." />}
          </div>
        </article>
        <article className="panel traffic-flow">
          <header className="panel__head"><h3>مسیر ترافیک</h3></header>
          <div><span><Globe2 /></span><p><small>تمام دامنه‌های عمومی</small><strong dir="ltr">{domains[0] || "DNS pending"}</strong></p></div><i /><div><span><RefreshCcw /></span><p><small>Nginx host routing</small><strong>Ports 80 / 443</strong></p></div><i /><div><span><BoxesIcon /></span><p><small>Application container</small><strong dir="ltr">127.0.0.1:{app.host_port}</strong></p></div>
        </article>
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
  appId, maxUpload, serverIp, navigate, notify, refreshApps,
}: {
  appId: number; maxUpload: number; serverIp: string; navigate: (route: string) => void;
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
      {tab === "overview" && <OverviewTab app={app} uploads={uploads} deployments={deployments} stats={stats} onUpload={() => setUploadOpen(true)} onDeploy={deploy} onBackup={backup} reload={load} notify={notify} />}
      {tab === "source" && <SourceTab app={app} uploads={uploads} notify={notify} />}
      {tab === "deployments" && <DeploymentsTab deployments={deployments} app={app} deploy={deploy} />}
      {tab === "logs" && <LogsTab app={app} notify={notify} />}
      {tab === "domain" && <DomainTab app={app} serverIp={serverIp} notify={notify} reload={load} />}
      {tab === "settings" && <SettingsTab app={app} notify={notify} reload={load} navigate={navigate} />}
      {uploadOpen && <UploadModal app={app} maxUpload={maxUpload} close={() => setUploadOpen(false)} notify={notify} completed={async () => { await load(); await refreshApps(); }} />}
    </>
  );
}
