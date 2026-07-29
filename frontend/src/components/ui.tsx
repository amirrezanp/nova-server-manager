"use client";

import { Check, X, LoaderCircle, PackageOpen } from "@/lib/icons";
import { ReactNode, useEffect } from "react";
import { statusLabels, typeLabels } from "@/lib/format";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`}>
      <div className="brand__mark"><span>N</span><i /></div>
      {!compact && <div><strong>نوا</strong><small>NOVA SERVER MANAGER</small></div>}
    </div>
  );
}

export function StatusBadge({ status, pulse = false }: { status: string; pulse?: boolean }) {
  return (
    <span className={`status status--${status}`}>
      <i className={pulse ? "pulse" : ""} />
      {statusLabels[status] || status}
    </span>
  );
}

export function AppGlyph({ type, size = "md" }: { type: string; size?: "sm" | "md" | "lg" }) {
  const value = typeLabels[type] || type;
  return <div className={`app-glyph app-glyph--${size} app-glyph--${type}`}>{value.slice(0, 3).toUpperCase()}</div>;
}

export function Modal({
  title, subtitle, children, onClose, wide = false,
}: {
  title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return (
    <div className="modal-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal ${wide ? "modal--wide" : ""}`}>
        <header className="modal__head">
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button className="icon-button" onClick={onClose}><X size={19} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

export interface ToastMessage { id: number; text: string; kind: "success" | "error" | "info" }

export function Toasts({ items, dismiss }: { items: ToastMessage[]; dismiss: (id: number) => void }) {
  return (
    <div className="toasts">
      {items.map((item) => (
        <button key={item.id} className={`toast toast--${item.kind}`} onClick={() => dismiss(item.id)}>
          <span>{item.kind === "success" ? <Check size={17} /> : item.kind === "error" ? <X size={17} /> : "i"}</span>
          <b>{item.text}</b>
        </button>
      ))}
    </div>
  );
}

export function Loader({ label = "در حال دریافت اطلاعات..." }: { label?: string }) {
  return <div className="page-loader"><LoaderCircle /><span>{label}</span></div>;
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span><PackageOpen /></span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function ProgressBar({ value, tone = "primary" }: { value: number; tone?: string }) {
  return <div className="progress"><i className={`progress__bar progress__bar--${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function Field({
  label, hint, children, className = "",
}: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return <label className={`field ${className}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
