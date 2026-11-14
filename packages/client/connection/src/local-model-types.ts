export interface LocalModelSummary {
  id: string;
  name: string;
  family: string;
  modality: "text" | "image" | "video" | "audio";
  task: string;
  repository: string;
  licenseName: string;
  licenseUrl: string;
  directory: string;
  estimatedDownloadBytes: number | null;
  installedBytes: number;
  installed: boolean;
  loaded: boolean;
  ready: boolean;
  reason: string | null;
}

export interface LocalModelDownloadSnapshot {
  id: string;
  modelId: string;
  status: "queued" | "downloading" | "completed" | "failed" | "cancelled";
  receivedBytes: number;
  totalBytes: number | null;
  completedFiles: number;
  totalFiles: number | null;
  message: string | null;
  startedAt: string;
  updatedAt: string;
}
