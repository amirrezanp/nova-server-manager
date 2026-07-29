"use client";

import { FormEvent, useState } from "react";
import { ArrowLeft, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { Logo } from "./ui";

export default function AuthView({
  setupRequired, onAuthenticated,
}: {
  setupRequired: boolean;
  onAuthenticated: (user: { id: number; username: string }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await api<{ user: { id: number; username: string } }>(
        `/api/auth/${setupRequired ? "setup" : "login"}`,
        { method: "POST", body: { username: data.get("username"), password: data.get("password") } as never },
      );
      onAuthenticated(result.user);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "ورود ناموفق بود");
    } finally { setBusy(false); }
  }

  return (
    <main className="auth">
      <div className="auth__mesh" />
      <section className="auth__showcase">
        <Logo />
        <div className="auth__pitch">
          <span className="eyebrow"><ShieldCheck size={16} /> کنترل‌پنل امن زیرساخت</span>
          <h1>تمام سرور شما،<br /><em>در یک مرکز فرمان.</em></h1>
          <p>دیپلوی، مانیتورینگ، دامنه، فایل‌ها و بکاپ‌ها را بدون پیچیدگی مدیریت کنید.</p>
        </div>
        <div className="auth__stats">
          <div><strong>۱۰+</strong><span>نوع سرویس</span></div>
          <div><strong>SSL</strong><span>خودکار و رایگان</span></div>
          <div><strong>24/7</strong><span>مانیتورینگ</span></div>
        </div>
      </section>
      <section className="auth__panel">
        <div className="auth-card">
          <span className="auth-card__icon"><LockKeyhole /></span>
          <h2>{setupRequired ? "راه‌اندازی نوا" : "خوش آمدید"}</h2>
          <p>{setupRequired ? "حساب مدیر اصلی را برای شروع بسازید." : "برای ورود به مرکز فرمان اطلاعات خود را وارد کنید."}</p>
          <form onSubmit={submit}>
            <label><span>نام کاربری</span><div className="input-wrap"><UserRound /><input name="username" minLength={3} autoComplete="username" required /></div></label>
            <label><span>رمز عبور</span><div className="input-wrap"><LockKeyhole /><input name="password" type="password" minLength={8} autoComplete={setupRequired ? "new-password" : "current-password"} required /></div></label>
            {error && <div className="form-error">{error}</div>}
            <button className="button button--primary button--large" disabled={busy}>
              {busy ? "در حال بررسی..." : setupRequired ? "ساخت حساب و شروع" : "ورود به پنل"} <ArrowLeft size={18} />
            </button>
          </form>
          <footer><ShieldCheck size={14} /> نشست رمزنگاری‌شده و امن</footer>
        </div>
      </section>
    </main>
  );
}

