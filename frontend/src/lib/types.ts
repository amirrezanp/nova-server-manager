export type AppStatus = "running" | "stopped" | "created" | "failed" | "deploying" | "restoring";

export interface NovaApp {
  id: number;
  name: string;
  display_name: string;
  app_type: string;
  status: AppStatus | string;
  domain: string;
  container_name: string;
  image: string;
  internal_port: number;
  host_port: number;
  start_command: string;
  source_dir: string;
  last_error: string;
  environment?: Record<string, string>;
  last_upload_name: string;
  last_upload_size: number;
  last_upload_at: string | null;
  source_size: number;
  source_files: number;
  last_deployed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SystemMetrics {
  cpu_percent: number;
  cpu_count: number;
  memory_percent: number;
  memory_used: number;
  memory_total: number;
  disk_percent: number;
  disk_used: number;
  disk_total: number;
  disk_free: number;
  max_upload_bytes: number;
  load: number[];
  uptime_seconds: number;
  hostname: string;
  os: string;
  docker: boolean;
  nginx: boolean;
}

export interface ActivityItem {
  id: number;
  action: string;
  detail: string;
  level: string;
  created_at: string;
}

export interface Backup {
  id: number;
  app_id: number;
  filename: string;
  size: number;
  destination: "local" | "telegram";
  status: string;
  error: string;
  created_at: string;
}

export interface BackupSchedule {
  id: number;
  app_id: number;
  enabled: boolean;
  destination: "local" | "telegram";
  interval_value: number;
  interval_unit: "minutes" | "hours" | "days";
  retention: number;
  last_run: string | null;
  next_run: string | null;
}

export interface UploadRecord {
  id: number;
  app_id: number;
  filename: string;
  size: number;
  status: string;
  files_extracted: number;
  extracted_size: number;
  error: string;
  created_at: string;
  completed_at: string | null;
}

export interface Deployment {
  id: number;
  app_id: number;
  status: string;
  stage: string;
  progress: number;
  output: string;
  image: string;
  trigger: string;
  duration_seconds: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface FileItem {
  name: string;
  path: string;
  directory: boolean;
  size: number;
  modified: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
  speed: number;
  remaining: number;
  eta: number | null;
  phase: "uploading" | "processing" | "completed" | "failed";
}

