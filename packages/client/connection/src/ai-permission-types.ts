import type { ApplicationId } from "lfaa-util-values/src/application-id.js";

export interface AiToolApproval {
  id: string;
  sessionId: string;
  appId: ApplicationId;
  toolId: string;
  toolVersion: string;
  risk: "read" | "write" | "dangerous";
  summary: string;
  scopeSummary: string;
  status: "pending" | "approved" | "denied" | "consumed" | "expired";
  requestedAt: string;
  expiresAt: string;
  decidedAt: string | null;
}

export interface AiToolPermissionGrant {
  id: string;
  appId: ApplicationId;
  toolId: string;
  toolVersion: string;
  risk: "write" | "dangerous";
  summary: string;
  scopeSummary: string;
  createdAt: string;
}
