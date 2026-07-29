export type AppStatus = "running" | "stopped" | "created" | "failed" | "deploying" | "restoring";

export interface NovaApp {
  id: number;
  name: string;
  display_name: string;
  app_type: string;
  status: AppStatus | string;
  domain: string;
  domains: string[];
  container_name: string;
  image: string;
  internal_port: number;
  host_port: number;
  start_command: string;
  source_dir: string;
  volume_name: string;
  database_admin_port: number;
  last_error: string;
  environment?: Record<string, string>;
  database?: DatabaseConnection;
  runtime?: ContainerRuntime;
  last_upload_name: string;
  last_upload_size: number;
  last_upload_at: string | null;
  source_size: number;
  source_files: number;
  last_deployed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContainerRuntime {
  cpu: string;
  cpu_percent: number;
  memory: string;
  memory_used: number;
  memory_limit: number;
  memory_percent: number;
  network: string;
  block: string;
  block_read: number;
  block_write: number;
}

export interface DatabaseConnection {
  engine: string;
  host: string;
  port: number;
  internal_host: string;
  internal_port: number;
  database: string;
  username: string;
  password: string;
  uri: string;
  internal_uri: string;
  volume: string;
  admin_enabled: boolean;
  admin_url: string;
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
  ip_addresses: string[];
  primary_ip: string;
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
  permissions: string;
  extension: string;
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
