const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  user: null, apps: [], metrics: null, setupRequired: false,
  route: "", currentApp: null, filePath: "", editorPath: "",
};

const icons = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  apps: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  backup: '<path d="M20 6v6h-6"/><path d="M20 12a8 8 0 1 1-2.34-5.66L20 8"/><path d="M12 8v5l3 2"/>',
  activity: '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2.83 2.83-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21h-4v-.09a1.65 1.65 0 0 0-1.08-1.5 1.65 1.65 0 0 0-1.82.33l-.06.06-2.83-2.83.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3v-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06 2.83-2.83.06.06A1.65 1.65 0 0 0 9 4.6h.08A1.65 1.65 0 0 0 10 3.09V3h4v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06 2.83 2.83-.06.06A1.65 1.65 0 0 0 19.4 9v.08A1.65 1.65 0 0 0 20.91 10H21v4h-.09A1.65 1.65 0 0 0 19.4 15z"/>',
  logout: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  refresh: '<path d="M20 11a8 8 0 1 0 2 5M20 4v7h-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="M5 3l14 9-14 9V3z"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  restart: '<path d="M20 11a8 8 0 1 0 2 5M20 4v7h-7"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
  file: '<path d="M6 2h9l5 5v15H6zM14 2v6h6"/>',
  trash: '<path d="M3 6h18M8 6V3h8v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  download: '<path d="M12 3v13M7 11l5 5 5-5"/><path d="M4 20h16"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  save: '<path d="M4 3h14l3 3v15H4zM8 3v6h8V3M8 21v-8h8v8"/>',
  code: '<path d="M8 9l-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/>',
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.file}</svg>`;
}
function hydrateIcons(root = document) {
  $$("[data-icon]", root).forEach(el => { el.innerHTML = icon(el.dataset.icon); });
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}
function encodedPath(value) { return encodeURIComponent(value).replace(/'/g, "%27"); }
function fa(value) { return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(value || 0); }
function bytes(value) {
  if (!value) return "۰ بایت";
  const units = ["بایت","KB","MB","GB","TB"]; let i = 0, n = value;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${fa(n)} ${units[i]}`;
}
function ago(date) {
  if (!date) return "—";
  const seconds = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "همین حالا";
  if (seconds < 3600) return `${fa(Math.floor(seconds / 60))} دقیقه پیش`;
  if (seconds < 86400) return `${fa(Math.floor(seconds / 3600))} ساعت پیش`;
  return `${fa(Math.floor(seconds / 86400))} روز پیش`;
}
const statusText = {running:"در حال اجرا",stopped:"متوقف",created:"ایجاد شده",failed:"خطا",deploying:"در حال دیپلوی",restoring:"در حال ریستور",completed:"موفق",creating:"در حال ساخت"};
const typeLabel = {nextjs:"Next.js",nodejs:"Node.js",django:"Django",fastapi:"FastAPI",flask:"Flask",php:"PHP",static:"Static",postgres:"PostgreSQL",mongodb:"MongoDB",docker:"Docker Image"};

async function api(url, options = {}) {
  const config = { credentials: "same-origin", ...options, headers: { ...(options.headers || {}) } };
  if (config.body && !(config.body instanceof FormData) && typeof config.body !== "string") {
    config.headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(config.body);
  }
  const response = await fetch(url, config);
  if (response.status === 401 && !url.includes("/auth/")) {
    showAuth(false); throw new Error("نشست شما پایان یافته است");
  }
  if (!response.ok) {
    let detail = `خطای ${response.status}`;
    try {
      const data = await response.json();
      detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || data);
    } catch (_) {}
    throw new Error(detail);
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("json") ? response.json() : response;
}
function toast(message, kind = "success") {
  const node = document.createElement("div");
  node.className = `toast ${kind}`;
  node.innerHTML = `<span>${kind === "success" ? "✓" : "!"}</span><div>${escapeHtml(message)}</div>`;
  $("#toast-root").append(node);
  setTimeout(() => node.remove(), 4500);
}
function loading() {
  $("#page-content").innerHTML = '<div class="page-loader"><span></span><p>در حال دریافت اطلاعات...</p></div>';
}
function modal(title, body, onSubmit, submitText = "ذخیره") {
  const root = $("#modal-root");
  root.innerHTML = `<div class="modal-backdrop"><div class="modal">
    <div class="modal-head"><h2>${escapeHtml(title)}</h2><button class="close-btn" type="button">×</button></div>
    <form id="modal-form">${body}<div class="modal-actions"><button class="btn" type="button" data-close>انصراف</button><button class="btn primary" type="submit">${submitText}</button></div></form>
  </div></div>`;
  const close = () => { root.innerHTML = ""; };
  $(".close-btn", root).onclick = close; $("[data-close]", root).onclick = close;
  $(".modal-backdrop", root).onclick = e => { if (e.target.classList.contains("modal-backdrop")) close(); };
  $("#modal-form", root).onsubmit = async e => {
    e.preventDefault(); const button = $('button[type="submit"]', e.currentTarget);
    button.disabled = true;
    try { await onSubmit(new FormData(e.currentTarget), close); }
    catch (err) { toast(err.message, "error"); button.disabled = false; }
  };
  hydrateIcons(root);
}

async function boot() {
  hydrateIcons();
  $("#auth-form").addEventListener("submit", submitAuth);
  $("#logout-button").onclick = logout;
  $("#refresh-button").onclick = () => renderRoute(true);
  $("#menu-button").onclick = () => $(".sidebar").classList.toggle("open");
  window.addEventListener("hashchange", () => renderRoute());
  try {
    const status = await api("/api/auth/status");
    state.setupRequired = status.setup_required;
    if (status.setup_required) return showAuth(true);
    state.user = await api("/api/auth/me");
    showShell();
  } catch (_) { showAuth(false); }
}
function showAuth(setup) {
  state.setupRequired = setup;
  $("#app-shell").classList.add("hidden"); $("#auth-screen").classList.remove("hidden");
  $("#auth-subtitle").textContent = setup ? "ساخت حساب مدیر برای راه‌اندازی اولیه" : "ورود به مرکز فرمان سرور";
  $("#auth-button-text").textContent = setup ? "ساخت حساب و شروع" : "ورود امن";
  $("#auth-password").autocomplete = setup ? "new-password" : "current-password";
}
async function submitAuth(e) {
  e.preventDefault();
  const endpoint = state.setupRequired ? "setup" : "login";
  const button = $('button[type="submit"]', e.currentTarget); button.disabled = true;
  try {
    const result = await api(`/api/auth/${endpoint}`, { method:"POST", body:{
      username: $("#auth-username").value.trim(), password: $("#auth-password").value,
    }});
    state.user = result.user; showShell();
  } catch (err) { toast(err.message, "error"); }
  finally { button.disabled = false; }
}
function showShell() {
  $("#auth-screen").classList.add("hidden"); $("#app-shell").classList.remove("hidden");
  $("#admin-name").textContent = state.user.username;
  $("#admin-avatar").textContent = state.user.username[0].toUpperCase();
  if (!location.hash) location.hash = "#/dashboard"; else renderRoute();
}
async function logout() {
  await api("/api/auth/logout", { method:"POST" }); state.user = null; showAuth(false);
}
function routeParts() { return location.hash.replace(/^#\//, "").split("/").filter(Boolean); }
async function renderRoute(force = false) {
  $(".sidebar").classList.remove("open");
  const parts = routeParts(), route = parts[0] || "dashboard";
  state.route = route;
  $$("nav a").forEach(a => a.classList.toggle("active", a.dataset.route === route || (route === "app" && a.dataset.route === "apps")));
  const titles = {dashboard:"داشبورد",apps:"برنامه‌ها",app:"مدیریت برنامه",backups:"بکاپ‌ها",activity:"گزارش فعالیت",settings:"تنظیمات"};
  $("#page-title").textContent = titles[route] || "نوا";
  loading();
  try {
    if (route === "dashboard") await renderDashboard();
    else if (route === "apps") await renderApps();
    else if (route === "app") await renderAppDetail(Number(parts[1]), parts[2] || "overview");
    else if (route === "backups") await renderBackups();
    else if (route === "activity") await renderActivity();
    else if (route === "settings") await renderSettings();
    else location.hash = "#/dashboard";
    hydrateIcons($("#page-content"));
  } catch (err) {
    $("#page-content").innerHTML = `<div class="card empty"><div class="empty-icon">!</div><h3>دریافت اطلاعات ناموفق بود</h3><p>${escapeHtml(err.message)}</p><button class="btn" onclick="renderRoute(true)">تلاش دوباره</button></div>`;
  }
}
async function loadBase() {
  const [apps, metrics] = await Promise.all([api("/api/apps"), api("/api/system/metrics")]);
  state.apps = apps; state.metrics = metrics;
  $("#app-count").textContent = fa(apps.length);
  $("#sidebar-server").textContent = `${metrics.hostname} · ${metrics.docker ? "Docker فعال" : "Docker غیرفعال"}`;
}
function metricCard(title, used, total, percent, color, detail) {
  return `<div class="metric-card"><div class="metric-copy"><span>${title}</span><strong>${used}</strong><small>${detail}</small></div><div class="ring" style="--value:${Math.min(100, percent)};--color:${color}"><b>${fa(percent)}٪</b></div></div>`;
}
function appIcon(app) { return `<div class="app-icon">${escapeHtml((typeLabel[app.app_type] || app.app_type).slice(0,3))}</div>`; }
function appRow(app) {
  return `<div class="app-row">${appIcon(app)}<div class="app-info"><b>${escapeHtml(app.display_name || app.name)}</b><small>${escapeHtml(app.domain || `127.0.0.1:${app.host_port}`)}</small></div><span class="badge ${app.status}">${statusText[app.status] || app.status}</span><a class="icon-btn" href="#/app/${app.id}/overview">←</a></div>`;
}
function activityRow(item) {
  return `<div class="activity-row"><span class="activity-dot" style="${item.level === "error" ? "background:var(--red)" : ""}"></span><div><b>${escapeHtml(item.action)}</b><p>${escapeHtml(item.detail)}</p><time>${ago(item.created_at)}</time></div></div>`;
}
async function renderDashboard() {
  const [, activity, backups] = await Promise.all([loadBase(), api("/api/system/activity"), api("/api/backups")]);
  const m = state.metrics;
  $("#page-content").innerHTML = `
    <div class="page-head"><div><h1>سلام ${escapeHtml(state.user.username)}، آماده‌ای؟</h1><p>نمای زنده‌ای از وضعیت سرور و سرویس‌های شما</p></div><button class="btn primary" onclick="openCreateApp()">${icon("plus")} برنامه جدید</button></div>
    <div class="grid metrics-grid">
      ${metricCard("پردازنده", `${fa(m.cpu_percent)}٪`, m.cpu_count, m.cpu_percent, "var(--primary)", `${fa(m.cpu_count)} هسته`)}
      ${metricCard("حافظه RAM", bytes(m.memory_used), m.memory_total, m.memory_percent, "var(--blue)", `از ${bytes(m.memory_total)}`)}
      ${metricCard("فضای دیسک", bytes(m.disk_used), m.disk_total, m.disk_percent, "var(--yellow)", `از ${bytes(m.disk_total)}`)}
      ${metricCard("برنامه‌های فعال", fa(state.apps.filter(a=>a.status==="running").length), state.apps.length, state.apps.length ? state.apps.filter(a=>a.status==="running").length/state.apps.length*100 : 0, "var(--green)", `از ${fa(state.apps.length)} برنامه`)}
    </div>
    <div class="grid dashboard-grid">
      <section class="card"><div class="card-head"><h2>برنامه‌های اخیر</h2><a href="#/apps">مشاهده همه</a></div>${state.apps.length ? state.apps.slice(0,5).map(appRow).join("") : emptySmall("هنوز برنامه‌ای ایجاد نشده است")}</section>
      <section class="card"><div class="card-head"><h2>آخرین فعالیت‌ها</h2><a href="#/activity">گزارش کامل</a></div>${activity.length ? activity.slice(0,5).map(activityRow).join("") : emptySmall("فعالیتی ثبت نشده است")}</section>
    </div>`;
}
function emptySmall(text) { return `<div class="empty"><div class="empty-icon">⌁</div><p>${text}</p></div>`; }
async function renderApps() {
  await loadBase();
  $("#page-content").innerHTML = `
    <div class="page-head"><div><h1>برنامه‌ها</h1><p>دیپلوی، دامنه و منابع تمام سرویس‌ها در یک جا</p></div><button class="btn primary" onclick="openCreateApp()">${icon("plus")} برنامه جدید</button></div>
    ${state.apps.length ? `<div class="grid apps-grid">${state.apps.map(appCard).join("")}</div>` : `<div class="card empty"><div class="empty-icon">+</div><h3>اولین برنامه را بسازید</h3><p>فایل ZIP پروژه را آپلود کنید و نوا آن را دیپلوی می‌کند.</p><button class="btn primary" onclick="openCreateApp()">ساخت برنامه</button></div>`}`;
}
function appCard(app) {
  return `<a class="card app-card" href="#/app/${app.id}/overview" style="text-decoration:none;color:inherit"><span class="stripe"></span><div class="app-card-head">${appIcon(app)}<div><h3>${escapeHtml(app.display_name || app.name)}</h3><small>${escapeHtml(typeLabel[app.app_type] || app.app_type)}</small></div><span class="badge ${app.status}">${statusText[app.status] || app.status}</span></div><span class="domain">${escapeHtml(app.domain || `127.0.0.1:${app.host_port}`)}</span><div class="app-card-footer"><small>ساخته شده ${ago(app.created_at)}</small><span>مدیریت ←</span></div></a>`;
}
function openCreateApp() {
  const options = Object.entries(typeLabel).map(([v,l]) => `<option value="${v}">${l}</option>`).join("");
  modal("ساخت برنامه جدید", `<div class="stack">
    <div class="form-grid"><label>نام نمایشی<input name="display_name" placeholder="فروشگاه من"></label><label>شناسه برنامه<input class="ltr" name="name" pattern="[a-z][a-z0-9-]{1,39}" placeholder="my-shop" required></label></div>
    <div class="form-grid"><label>نوع برنامه<select name="app_type">${options}</select></label><label>پورت داخلی<input class="ltr" name="internal_port" type="number" value="3000" min="1" max="65535"></label></div>
    <label>دستور اجرا (اختیاری)<input class="ltr" name="start_command" placeholder="npm start"></label>
    <label>Docker Image (فقط برای نوع Docker)<input class="ltr" name="image" placeholder="ghcr.io/user/app:latest"></label>
    <label>متغیرهای محیطی (هر خط KEY=VALUE)<textarea class="ltr" name="environment" placeholder="NODE_ENV=production&#10;API_KEY=..."></textarea></label>
    <label>فایل پروژه (ZIP، اختیاری)<input name="source" type="file" accept=".zip"></label>
    <p class="hint">برای PostgreSQL و MongoDB در صورت خالی بودن، نام کاربری و رمز امن به‌طور خودکار ساخته می‌شود.</p>
  </div>`, async (form, close) => {
    const env = {};
    String(form.get("environment") || "").split("\n").filter(Boolean).forEach(line => {
      const i = line.indexOf("="); if (i > 0) env[line.slice(0,i).trim()] = line.slice(i+1).trim();
    });
    const created = await api("/api/apps", {method:"POST", body:{
      name: form.get("name").trim(), display_name: form.get("display_name").trim(),
      app_type: form.get("app_type"), internal_port:Number(form.get("internal_port")),
      start_command:form.get("start_command"), image:form.get("image"), environment:env,
    }});
    const file = form.get("source");
    if (file && file.size) {
      const upload = new FormData(); upload.append("file", file);
      await api(`/api/apps/${created.id}/upload`, {method:"POST", body:upload});
    }
    close(); toast("برنامه ساخته شد");
    location.hash = `#/app/${created.id}/overview`;
  }, "ساخت برنامه");
}

async function renderAppDetail(id, tab) {
  const app = await api(`/api/apps/${id}`); state.currentApp = app;
  const tabs = [["overview","نمای کلی"],["files","مدیریت فایل"],["logs","لاگ‌ها"],["console","کنسول"],["domain","دامنه"],["settings","تنظیمات"]];
  $("#page-content").innerHTML = `
    <section class="card detail-hero">${appIcon(app)}<div class="detail-title"><h1>${escapeHtml(app.display_name || app.name)}</h1><p>${escapeHtml(typeLabel[app.app_type])} · ${escapeHtml(app.domain || `127.0.0.1:${app.host_port}`)}</p></div><span class="badge ${app.status}">${statusText[app.status] || app.status}</span>
      <div class="action-group"><button class="btn primary" onclick="deployApp(${app.id})">${icon("upload")} دیپلوی</button><button class="btn" onclick="appAction(${app.id},'restart')">${icon("restart")} ری‌استارت</button><button class="btn" onclick="appAction(${app.id},'${app.status==="running"?"stop":"start"}')">${icon(app.status==="running"?"stop":"play")} ${app.status==="running"?"توقف":"شروع"}</button></div>
    </section>
    <div class="tabs">${tabs.map(([v,l])=>`<a class="tab ${tab===v?"active":""}" href="#/app/${id}/${v}">${l}</a>`).join("")}</div>
    <div id="app-tab-content"></div>`;
  if (tab === "overview") renderOverview(app);
  else if (tab === "files") await renderFiles(app, "");
  else if (tab === "logs") await renderLogs(app);
  else if (tab === "console") renderConsole(app);
  else if (tab === "domain") renderDomain(app);
  else renderAppSettings(app);
}
function renderOverview(app) {
  const envKeys = Object.keys(app.environment || {});
  $("#app-tab-content").innerHTML = `<div class="grid detail-grid">
    <section class="card"><div class="card-head"><h2>مشخصات سرویس</h2></div><div class="info-list">
      <div class="info-item"><span>نام کانتینر</span><b>${escapeHtml(app.container_name)}</b></div><div class="info-item"><span>آدرس داخلی</span><b>127.0.0.1:${app.host_port}</b></div>
      <div class="info-item"><span>Image</span><b>${escapeHtml(app.image || "پس از دیپلوی ساخته می‌شود")}</b></div><div class="info-item"><span>پورت برنامه</span><b>${app.internal_port}</b></div>
      <div class="info-item"><span>پوشه سورس</span><b>${escapeHtml(app.source_dir)}</b></div><div class="info-item"><span>متغیر محیطی</span><b>${fa(envKeys.length)} مورد</b></div>
    </div>${app.last_error ? `<div class="notice" style="margin-top:14px;color:#ff9ca5;border-color:#ff526344;background:#ff526311"><b>آخرین خطا</b><br>${escapeHtml(app.last_error)}</div>`:""}</section>
    <section class="card"><div class="card-head"><h2>عملیات سریع</h2></div><div class="stack">
      <button class="btn" onclick="openUpload(${app.id})">${icon("upload")} آپلود نسخه جدید</button>
      <button class="btn" onclick="createBackup(${app.id},'local')">${icon("backup")} بکاپ روی سرور</button>
      <button class="btn" onclick="createBackup(${app.id},'telegram')">${icon("backup")} ارسال بکاپ به تلگرام</button>
      <a class="btn" href="#/app/${app.id}/domain">${icon("globe")} اتصال دامنه و SSL</a>
    </div></section></div>`;
}
async function deployApp(id) {
  if (!confirm("نسخهٔ فعلی Build و کانتینر برنامه جایگزین شود؟")) return;
  try { await api(`/api/apps/${id}/deploy`, {method:"POST"}); toast("دیپلوی در پس‌زمینه شروع شد"); renderRoute(); }
  catch (err) { toast(err.message, "error"); }
}
async function appAction(id, action) {
  try { await api(`/api/apps/${id}/actions/${action}`, {method:"POST"}); toast("عملیات با موفقیت انجام شد"); renderRoute(); }
  catch (err) { toast(err.message, "error"); }
}
function openUpload(id) {
  modal("آپلود سورس برنامه", `<div class="stack"><div class="notice">فایل ZIP جایگزین سورس فعلی می‌شود. برای امکان بازگشت، ابتدا بکاپ بگیرید.</div><label>فایل ZIP<input name="source" type="file" accept=".zip" required></label></div>`, async(form, close)=>{
    const body = new FormData(); body.append("file", form.get("source"));
    await api(`/api/apps/${id}/upload`, {method:"POST",body}); close(); toast("سورس با موفقیت آپلود شد");
  }, "آپلود");
}
async function renderLogs(app) {
  const result = await api(`/api/apps/${app.id}/logs?tail=500`);
  $("#app-tab-content").innerHTML = `<div class="terminal"><div class="terminal-head"><i></i><i></i><i></i><button class="btn small" style="margin-left:0;margin-right:auto" onclick="renderRoute(true)">تازه‌سازی</button></div><pre>${escapeHtml(result.logs || "هنوز لاگی ثبت نشده است.")}</pre></div>`;
  const pre = $(".terminal pre"); pre.scrollTop = pre.scrollHeight;
}
function renderConsole(app) {
  $("#app-tab-content").innerHTML = `<div class="terminal"><div class="terminal-head"><i></i><i></i><i></i><span style="color:var(--muted);font-size:11px;margin-left:auto">Shell داخل کانتینر ${escapeHtml(app.container_name)}</span></div><pre id="console-output">$ آماده دریافت فرمان...</pre><form id="console-form" style="display:flex;padding:10px;background:#111019;border-top:1px solid var(--border);gap:8px"><span style="color:var(--green);padding:11px 2px">$</span><input id="console-command" class="ltr" style="font-family:Consolas,monospace" autocomplete="off" placeholder="ls -la" required><button class="btn primary" type="submit">اجرا</button></form></div><p class="hint" style="margin-top:10px">فرمان فقط داخل کانتینر این برنامه اجرا می‌شود و به Shell میزبان دسترسی مستقیم ندارد.</p>`;
  $("#console-form").onsubmit = async e => {
    e.preventDefault(); const input=$("#console-command"), command=input.value.trim(), output=$("#console-output"), button=$('button',e.target);
    if(!command)return; button.disabled=true; output.textContent += `\n$ ${command}\n`; input.value="";
    try { const result=await api(`/api/apps/${app.id}/exec`,{method:"POST",body:{command}}); output.textContent += result.output || `(exit ${result.exit_code})`; }
    catch(err){output.textContent += `خطا: ${err.message}`;} finally {button.disabled=false;output.scrollTop=output.scrollHeight;input.focus();}
  };
}
async function renderFiles(app, path) {
  state.filePath = path;
  const data = await api(`/api/apps/${app.id}/files?path=${encodeURIComponent(path)}`);
  const parent = path.split("/").slice(0,-1).join("/");
  $("#app-tab-content").innerHTML = `<section class="card file-layout"><div class="file-tree">
    <div class="file-toolbar"><button class="btn small" onclick="newFile(false)">${icon("plus")} فایل</button><button class="btn small" onclick="newFile(true)">${icon("folder")} پوشه</button></div>
    <div class="file-path">/${escapeHtml(path)}</div>
    ${path ? `<div class="file-row" onclick="goFolder('${encodedPath(parent)}')"><b>↩</b><span>پوشه بالاتر</span></div>`:""}
    ${data.items.map(item=>`<div class="file-row" onclick="${item.directory ? `goFolder('${encodedPath(item.path)}')` : `openFile('${encodedPath(item.path)}')`}">${icon(item.directory?"folder":"file")}<span>${escapeHtml(item.name)}</span><small>${item.directory?"":bytes(item.size)}</small><button class="close-btn" style="width:25px;height:25px;font-size:14px" onclick="event.stopPropagation();deleteFile('${encodedPath(item.path)}')">×</button></div>`).join("") || emptySmall("پوشه خالی است")}
  </div><div class="editor-pane" id="editor-pane"><div class="empty"><div class="empty-icon">&lt;/&gt;</div><h3>ویرایشگر فایل</h3><p>یک فایل متنی را برای ویرایش انتخاب کنید.</p></div></div></section>`;
  hydrateIcons($("#app-tab-content"));
}
function goFolder(encoded) { renderFiles(state.currentApp, decodeURIComponent(encoded)); }
async function openFile(encodedPath) {
  const path = decodeURIComponent(encodedPath);
  try {
    const data = await api(`/api/apps/${state.currentApp.id}/files/content?path=${encodeURIComponent(path)}`);
    state.editorPath = path;
    $("#editor-pane").innerHTML = `<div class="editor-head"><code>${escapeHtml(path)}</code><button class="btn primary small" onclick="saveFile()">${icon("save")} ذخیره</button></div><textarea id="code-editor" spellcheck="false">${escapeHtml(data.content)}</textarea>`;
    hydrateIcons($("#editor-pane"));
    $("#code-editor").addEventListener("keydown", e => {
      if (e.key === "Tab") { e.preventDefault(); const t=e.target,s=t.selectionStart;t.value=t.value.slice(0,s)+"  "+t.value.slice(t.selectionEnd);t.selectionStart=t.selectionEnd=s+2; }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); saveFile(); }
    });
  } catch(err) { toast(err.message, "error"); }
}
async function saveFile() {
  try { await api(`/api/apps/${state.currentApp.id}/files/content`, {method:"PUT", body:{path:state.editorPath,content:$("#code-editor").value}}); toast("فایل ذخیره شد"); }
  catch(err) { toast(err.message,"error"); }
}
function newFile(directory) {
  const name = prompt(directory ? "نام پوشه جدید:" : "نام فایل جدید:");
  if (!name || name.includes("/") || name.includes("\\")) return;
  const path = [state.filePath,name].filter(Boolean).join("/");
  api(`/api/apps/${state.currentApp.id}/files`, {method:"POST",body:{path,directory}})
    .then(()=>renderFiles(state.currentApp,state.filePath)).catch(err=>toast(err.message,"error"));
}
async function deleteFile(encodedPath) {
  const path=decodeURIComponent(encodedPath); if(!confirm(`«${path}» حذف شود؟`))return;
  try{await api(`/api/apps/${state.currentApp.id}/files?path=${encodeURIComponent(path)}`,{method:"DELETE"});await renderFiles(state.currentApp,state.filePath);toast("حذف شد");}catch(err){toast(err.message,"error")}
}
function renderDomain(app) {
  $("#app-tab-content").innerHTML = `<div class="grid detail-grid"><section class="card"><div class="card-head"><h2>اتصال دامنه</h2></div><form id="domain-form" class="stack">
    <div class="notice">ابتدا رکورد A دامنه را به IP این سرور متصل کنید. سپس نوا Nginx و گواهی رایگان Let’s Encrypt را تنظیم می‌کند.</div>
    <label>نام دامنه<input class="ltr" name="domain" value="${escapeHtml(app.domain)}" placeholder="app.example.com" required></label>
    <label style="flex-direction:row;align-items:center"><input name="ssl" type="checkbox" checked style="width:18px;height:18px"> فعال‌سازی HTTPS و انتقال خودکار</label>
    <button class="btn primary" type="submit">${icon("globe")} اتصال دامنه</button>
  </form></section><section class="card"><div class="card-head"><h2>مسیر ترافیک</h2></div><div class="info-list" style="grid-template-columns:1fr"><div class="info-item"><span>دامنه عمومی</span><b>${escapeHtml(app.domain||"تنظیم نشده")}</b></div><div class="info-item"><span>مقصد داخلی</span><b>http://127.0.0.1:${app.host_port}</b></div></div></section></div>`;
  $("#domain-form").onsubmit=async e=>{e.preventDefault();const b=$('button[type="submit"]',e.target);b.disabled=true;try{await api(`/api/apps/${app.id}/domain`,{method:"POST",body:{domain:e.target.domain.value.trim(),enable_ssl:e.target.ssl.checked}});toast("دامنه با موفقیت متصل شد");renderRoute();}catch(err){toast(err.message,"error");b.disabled=false}};
}
function renderAppSettings(app) {
  const envText=Object.entries(app.environment||{}).map(([k,v])=>`${k}=${v}`).join("\n");
  $("#app-tab-content").innerHTML=`<div class="grid detail-grid"><section class="card"><div class="card-head"><h2>تنظیمات اجرا</h2></div><form id="app-settings-form" class="stack"><label>نام نمایشی<input name="display_name" value="${escapeHtml(app.display_name)}"></label><div class="form-grid"><label>پورت داخلی<input name="internal_port" type="number" value="${app.internal_port}"></label><label>دستور اجرا<input class="ltr" name="start_command" value="${escapeHtml(app.start_command)}"></label></div><label>متغیرهای محیطی<textarea class="ltr" name="environment">${escapeHtml(envText)}</textarea></label><button class="btn primary">ذخیره تنظیمات</button></form></section><section class="card danger-zone"><div class="card-head"><h2>منطقه خطر</h2></div><p class="hint">حذف برنامه قابل بازگشت نیست. حذف داده، سورس و volume دیتابیس را نیز پاک می‌کند.</p><button class="btn danger" onclick="deleteApp(${app.id})">${icon("trash")} حذف برنامه</button></section></div>`;
  $("#app-settings-form").onsubmit=async e=>{e.preventDefault();const env={};e.target.environment.value.split("\n").filter(Boolean).forEach(x=>{const i=x.indexOf("=");if(i>0)env[x.slice(0,i).trim()]=x.slice(i+1).trim()});try{await api(`/api/apps/${app.id}`,{method:"PATCH",body:{display_name:e.target.display_name.value,internal_port:Number(e.target.internal_port.value),start_command:e.target.start_command.value,environment:env}});toast("تنظیمات ذخیره شد؛ برای اعمال دوباره دیپلوی کنید");}catch(err){toast(err.message,"error")}};
}
async function deleteApp(id){if(!confirm("برنامه و کانتینر حذف شود؟"))return;const data=confirm("آیا سورس و دادهٔ دیتابیس نیز برای همیشه حذف شود؟");try{await api(`/api/apps/${id}?delete_data=${data}`,{method:"DELETE"});toast("برنامه حذف شد");location.hash="#/apps"}catch(err){toast(err.message,"error")}}

async function createBackup(id,destination){try{await api(`/api/backups/apps/${id}`,{method:"POST",body:{destination}});toast(destination==="telegram"?"ساخت و ارسال بکاپ آغاز شد":"ساخت بکاپ آغاز شد");}catch(err){toast(err.message,"error")}}
async function renderBackups(){
  const [backups,apps,schedules,tg]=await Promise.all([api("/api/backups"),api("/api/apps"),api("/api/backups/schedules/all"),api("/api/settings/telegram")]);state.apps=apps;
  const rows=backups.map(b=>{const app=apps.find(a=>a.id===b.app_id);return `<tr><td>${escapeHtml(app?.display_name||"حذف شده")}</td><td>${ago(b.created_at)}</td><td>${bytes(b.size)}</td><td>${b.destination==="telegram"?"تلگرام":"روی سرور"}</td><td><span class="badge ${b.status}">${statusText[b.status]||b.status}</span></td><td><div class="table-actions">${b.status==="completed"?`<a class="btn small" href="/api/backups/items/${b.id}/download">${icon("download")}</a><button class="btn small" onclick="restoreBackup(${b.id})">${icon("restore")}</button>`:""}<button class="btn small danger" onclick="deleteBackup(${b.id})">${icon("trash")}</button></div></td></tr>`}).join("");
  $("#page-content").innerHTML=`<div class="page-head"><div><h1>بکاپ‌ها</h1><p>نسخه‌های محلی، ارسال تلگرام و بازیابی برنامه‌ها</p></div><button class="btn primary" onclick="openBackup()">${icon("plus")} بکاپ جدید</button></div>
  <div class="grid detail-grid" style="margin-bottom:20px"><section class="card"><div class="card-head"><h2>زمان‌بندی خودکار</h2><button class="btn small" onclick="openSchedule()">${icon("plus")} افزودن</button></div>${schedules.length?schedules.map(s=>{const a=apps.find(x=>x.id===s.app_id);return `<div class="app-row"><div class="app-info"><b>${escapeHtml(a?.display_name||"برنامه")}</b><small>هر ${fa(s.interval_value)} ${s.interval_unit==="days"?"روز":s.interval_unit==="hours"?"ساعت":"دقیقه"} · نگهداری ${fa(s.retention)}</small></div><span class="badge ${s.enabled?"running":""}">${s.enabled?"فعال":"غیرفعال"}</span><button class="btn small danger" onclick="deleteSchedule(${s.id})">×</button></div>`}).join(""):emptySmall("زمان‌بندی تعریف نشده است")}</section>
  <section class="card"><div class="card-head"><h2>ارسال تلگرام</h2><span class="badge ${tg.configured?"running":""}">${tg.configured?"متصل":"تنظیم نشده"}</span></div><p class="hint">${tg.configured?`Chat ID: ${escapeHtml(tg.chat_id)} · Token ${escapeHtml(tg.token_hint)}`:"توکن BotFather و آیدی عددی مدیر را وارد کنید."}</p><button class="btn" onclick="openTelegram()">${icon("settings")} تنظیم اتصال</button>${tg.configured?` <button class="btn" onclick="testTelegram()">تست ارسال</button>`:""}</section></div>
  <section class="card"><div class="card-head"><h2>آرشیو بکاپ‌ها</h2><span>${fa(backups.length)} فایل</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>برنامه</th><th>زمان</th><th>حجم</th><th>مقصد</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>${rows||`<tr><td colspan="6">${emptySmall("بکاپی وجود ندارد")}</td></tr>`}</tbody></table></div></section>`;
}
function openBackup(){if(!state.apps.length)return toast("ابتدا یک برنامه بسازید","error");modal("دریافت بکاپ",`<div class="stack"><label>برنامه<select name="app">${state.apps.map(a=>`<option value="${a.id}">${escapeHtml(a.display_name)}</option>`).join("")}</select></label><label>مقصد<select name="destination"><option value="local">ذخیره روی سرور</option><option value="telegram">ارسال به تلگرام</option></select></label></div>`,async(f,c)=>{await createBackup(Number(f.get("app")),f.get("destination"));c()},"شروع بکاپ")}
function openSchedule(){if(!state.apps.length)return toast("ابتدا یک برنامه بسازید","error");modal("زمان‌بندی بکاپ",`<div class="stack"><label>برنامه<select name="app">${state.apps.map(a=>`<option value="${a.id}">${escapeHtml(a.display_name)}</option>`).join("")}</select></label><div class="form-grid"><label>هر چند واحد<input name="value" type="number" min="1" value="24"></label><label>واحد<select name="unit"><option value="hours">ساعت</option><option value="days">روز</option><option value="minutes">دقیقه</option></select></label></div><div class="form-grid"><label>مقصد<select name="destination"><option value="local">روی سرور</option><option value="telegram">تلگرام</option></select></label><label>تعداد نگهداری<input name="retention" type="number" min="1" max="100" value="7"></label></div></div>`,async(f,c)=>{await api("/api/backups/schedules",{method:"POST",body:{app_id:Number(f.get("app")),enabled:true,destination:f.get("destination"),interval_value:Number(f.get("value")),interval_unit:f.get("unit"),retention:Number(f.get("retention"))}});c();toast("زمان‌بندی ساخته شد");renderRoute()},"ساخت زمان‌بندی")}
function openTelegram(){modal("اتصال ربات تلگرام",`<div class="stack"><div class="notice">در BotFather یک ربات بسازید، سپس یک پیام به ربات بفرستید و آیدی عددی خود را وارد کنید.</div><label>Bot Token<input class="ltr" name="token" type="password" placeholder="123456:ABC..." required></label><label>Admin Chat ID<input class="ltr" name="chat" placeholder="123456789" required></label></div>`,async(f,c)=>{await api("/api/settings/telegram",{method:"PUT",body:{bot_token:f.get("token"),admin_chat_id:f.get("chat")}});c();toast("تلگرام متصل شد");renderRoute()},"اتصال و بررسی")}
async function testTelegram(){try{await api("/api/settings/telegram/test",{method:"POST"});toast("پیام تست ارسال شد")}catch(err){toast(err.message,"error")}}
async function restoreBackup(id){if(!confirm("محتوای فعلی برنامه با این بکاپ جایگزین و دوباره دیپلوی شود؟"))return;try{await api(`/api/backups/items/${id}/restore`,{method:"POST"});toast("بازیابی در پس‌زمینه آغاز شد")}catch(err){toast(err.message,"error")}}
async function deleteBackup(id){if(!confirm("فایل بکاپ حذف شود؟"))return;try{await api(`/api/backups/items/${id}`,{method:"DELETE"});toast("بکاپ حذف شد");renderRoute()}catch(err){toast(err.message,"error")}}
async function deleteSchedule(id){if(!confirm("زمان‌بندی حذف شود؟"))return;try{await api(`/api/backups/schedules/${id}`,{method:"DELETE"});renderRoute()}catch(err){toast(err.message,"error")}}

async function renderActivity(){const activity=await api("/api/system/activity");$("#page-content").innerHTML=`<div class="page-head"><div><h1>گزارش فعالیت</h1><p>رویدادهای مهم و عملیات مدیریتی پنل</p></div></div><section class="card">${activity.length?activity.map(activityRow).join(""):emptySmall("فعالیتی ثبت نشده است")}</section>`}
async function renderSettings(){const [m,tg]=await Promise.all([api("/api/system/metrics"),api("/api/settings/telegram")]);$("#page-content").innerHTML=`<div class="page-head"><div><h1>تنظیمات سرور</h1><p>مشخصات زیرساخت و عملیات سطح سیستم</p></div></div><div class="grid detail-grid"><section class="card"><div class="card-head"><h2>مشخصات سرور</h2></div><div class="info-list"><div class="info-item"><span>Hostname</span><b>${escapeHtml(m.hostname)}</b></div><div class="info-item"><span>سیستم عامل</span><b>${escapeHtml(m.os)}</b></div><div class="info-item"><span>Docker</span><b>${m.docker?"Active":"Unavailable"}</b></div><div class="info-item"><span>Nginx</span><b>${m.nginx?"Installed":"Unavailable"}</b></div><div class="info-item"><span>Uptime</span><b>${fa(Math.floor(m.uptime_seconds/3600))} hours</b></div><div class="info-item"><span>Load average</span><b>${m.load.map(x=>Number(x).toFixed(2)).join(" / ")}</b></div></div></section><section class="card danger-zone"><div class="card-head"><h2>کنترل سرور</h2></div><div class="notice" style="margin-bottom:18px">این عملیات کل سرور و همهٔ برنامه‌ها را تحت تأثیر قرار می‌دهد.</div><div class="action-group"><button class="btn danger" onclick="serverAction('RESTART')">${icon("restart")} ری‌استارت سرور</button><button class="btn danger" onclick="serverAction('SHUTDOWN')">${icon("stop")} خاموش کردن</button></div></section></div><section class="card" style="margin-top:20px"><div class="card-head"><h2>امنیت پنل</h2></div><p class="hint">پنل را مستقیماً روی پورت عمومی رها نکنید. دامنه، HTTPS و محدودیت فایروال را طبق راهنمای نصب فعال کنید. نشست ورود HttpOnly و SameSite است و توکن تلگرام به‌صورت رمز‌شده ذخیره می‌شود.</p></section>`}
async function serverAction(action){const word=action==="RESTART"?"RESTART":"SHUTDOWN";const entered=prompt(`برای تأیید عبارت ${word} را وارد کنید:`);if(entered!==word)return;try{await api("/api/system/action",{method:"POST",body:{confirmation:word}});toast("دستور برای سرور ارسال شد")}catch(err){toast(err.message,"error")}}

Object.assign(window,{renderRoute,openCreateApp,deployApp,appAction,openUpload,createBackup,renderFiles,goFolder,openFile,saveFile,newFile,deleteFile,deleteApp,openBackup,openSchedule,openTelegram,testTelegram,restoreBackup,deleteBackup,deleteSchedule,serverAction,state});
boot();
