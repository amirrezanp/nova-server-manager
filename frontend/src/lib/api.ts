import type { UploadProgress } from "./types";

export class ApiError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
  }
}

type ApiOptions = Omit<RequestInit, "body"> & { body?: unknown };

export async function api<T = unknown>(url: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  let body = options.body as BodyInit | null | undefined;
  if (body && !(body instanceof FormData) && typeof body !== "string") {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }
  const response = await fetch(url, { ...options, headers, body, credentials: "same-origin" } as RequestInit);
  if (!response.ok) {
    let message = `خطای ${response.status}`;
    try {
      const payload = await response.json();
      message = typeof payload.detail === "string" ? payload.detail : JSON.stringify(payload.detail ?? payload);
    } catch {}
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function uploadSource<T>(
  appId: number,
  file: File,
  onProgress: (progress: UploadProgress) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);
    const startedAt = performance.now();

    xhr.open("POST", `/api/apps/${appId}/upload`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const seconds = Math.max((performance.now() - startedAt) / 1000, 0.1);
      const speed = event.loaded / seconds;
      const remaining = Math.max(0, event.total - event.loaded);
      onProgress({
        loaded: event.loaded,
        total: event.total,
        percent: Math.min(99, (event.loaded / event.total) * 100),
        speed,
        remaining,
        eta: speed > 0 ? remaining / speed : null,
        phase: event.loaded >= event.total ? "processing" : "uploading",
      });
    };
    xhr.upload.onload = () => {
      onProgress({
        loaded: file.size,
        total: file.size,
        percent: 99,
        speed: file.size / Math.max((performance.now() - startedAt) / 1000, 0.1),
        remaining: 0,
        eta: null,
        phase: "processing",
      });
    };
    xhr.onload = () => {
      let payload: unknown;
      try { payload = JSON.parse(xhr.responseText); } catch { payload = {}; }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress({
          loaded: file.size, total: file.size, percent: 100, speed: 0,
          remaining: 0, eta: 0, phase: "completed",
        });
        resolve(payload as T);
      } else {
        const data = payload as { detail?: string };
        reject(new ApiError(data.detail || `آپلود ناموفق بود (${xhr.status})`, xhr.status));
      }
    };
    xhr.onerror = () => reject(new ApiError("ارتباط هنگام آپلود قطع شد"));
    xhr.send(form);
  });
}
