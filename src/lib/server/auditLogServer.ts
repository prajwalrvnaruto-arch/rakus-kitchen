import "server-only";
import { adminDb } from "./firebaseAdmin";
import { sanitizeFirestoreData } from "@/lib/sanitize";
import type { AuditAction } from "@/types";

const AUDIT_RETENTION_DAYS = 30;

export async function recordServerAuditLog(params: {
  action: AuditAction;
  actor: {
    uid?: string;
    email?: string;
    name?: string;
    type: "admin" | "customer" | "system";
  };
  targetId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const db = adminDb();
    const now = Date.now();
    const expiresAt = now + AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    await db.collection("auditLogs").add(
      sanitizeFirestoreData({
        ...params,
        createdAt: now,
        expiresAt,
      }),
    );
  } catch (err) {
    console.warn("[ServerAuditLogger] Failed to write audit log:", err);
  }
}
