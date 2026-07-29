export const typeLabels: Record<string, string> = {
  nextjs: "Next.js", nodejs: "Node.js", django: "Django", fastapi: "FastAPI",
  flask: "Flask", php: "PHP", static: "Static", postgres: "PostgreSQL",
  mongodb: "MongoDB", docker: "Docker Image",
};

export const statusLabels: Record<string, string> = {
  running: "در حال اجرا", stopped: "متوقف", created: "آماده‌سازی",
  failed: "ناموفق", deploying: "در حال دیپلوی", restoring: "بازیابی",
  completed: "موفق", processing: "پردازش", queued: "در صف",
};

export const stageLabels: Record<string, string> = {
  queued: "در صف اجرا", preparing: "آماده‌سازی", generating_build: "ساخت تنظیمات",
  building_image: "ساخت Docker Image", pulling_and_starting: "دریافت و اجرای Image",
  starting_container: "اجرای کانتینر", starting_database: "راه‌اندازی دیتابیس",
  verifying: "بررسی سلامت", completed: "تکمیل شده", failed: "ناموفق",
};

export function fa(value: number, digits = 1) {
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: digits }).format(value || 0);
}

export function bytes(value = 0) {
  if (!value) return "۰ بایت";
  const units = ["بایت", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return `${fa(size)} ${units[unit]}`;
}

export function duration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${fa(seconds, 0)} ثانیه`;
  return `${fa(Math.floor(seconds / 60), 0)} دقیقه و ${fa(seconds % 60, 0)} ثانیه`;
}

export function ago(date?: string | null) {
  if (!date) return "—";
  const seconds = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "همین حالا";
  if (seconds < 3600) return `${fa(Math.floor(seconds / 60), 0)} دقیقه پیش`;
  if (seconds < 86400) return `${fa(Math.floor(seconds / 3600), 0)} ساعت پیش`;
  return `${fa(Math.floor(seconds / 86400), 0)} روز پیش`;
}

export function dateTime(date?: string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium", timeStyle: "short",
  }).format(new Date(date));
}

