/**
 * Utility to prune expired audit logs from Firestore.
 *
 * Usage:
 *   node --env-file=.env.local scripts/prune-audit-logs.mjs          # Dry run
 *   node --env-file=.env.local scripts/prune-audit-logs.mjs --apply  # Actually deletes expired logs
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_ADMIN_* credentials in .env.local");
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();
const apply = process.argv.includes("--apply");
const now = Date.now();

console.log("=== Audit Log Pruning Utility ===");
console.log(`Mode: ${apply ? "🔴 LIVE WRITE (--apply)" : "🟡 DRY RUN"}\n`);

// Query logs where expiresAt <= now
const expiredSnap = await db.collection("auditLogs").where("expiresAt", "<=", now).get();

if (expiredSnap.empty) {
  console.log("No expired audit logs found. Everything is within the 30-day retention window.");
  process.exit(0);
}

console.log(`Found ${expiredSnap.size} expired audit log(s).`);

if (!apply) {
  console.log("\nDry run only. Run with --apply to delete expired logs.");
  process.exit(0);
}

const batch = db.batch();
for (const doc of expiredSnap.docs) {
  batch.delete(doc.ref);
}
await batch.commit();

console.log(`✅ Successfully deleted ${expiredSnap.size} expired audit log(s).`);
