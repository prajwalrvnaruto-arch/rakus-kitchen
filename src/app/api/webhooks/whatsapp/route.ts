import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { adminDb } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

/**
 * Meta WhatsApp Cloud API webhook — delivery status callback for OTP sends.
 *
 * Configure in App Dashboard → WhatsApp → Configuration → Webhook:
 *   Callback URL: https://<domain>/api/webhooks/whatsapp
 *   Verify token: WHATSAPP_WEBHOOK_VERIFY_TOKEN (set below, any random string you choose)
 *   Subscribe to field: messages
 *
 * This endpoint is informational only — it records delivery status
 * (sent/delivered/read/failed) against the matching phoneVerifications doc
 * for diagnostics. It never grants login; login still goes exclusively
 * through verify-otp's hash check in phoneAuth.ts.
 */

interface WhatsAppStatusEntry {
  id: string; // wamid
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id?: string;
  biz_opaque_callback_data?: string; // the requestId we sent on the send call
  errors?: Array<{ code: number; title: string; message?: string }>;
}

interface WhatsAppWebhookPayload {
  object?: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      value?: {
        statuses?: WhatsAppStatusEntry[];
      };
      field?: string;
    }>;
  }>;
}

/**
 * Meta's webhook subscription handshake: GET with hub.mode=subscribe,
 * hub.challenge, hub.verify_token. Must echo hub.challenge back verbatim
 * (as plain text, not JSON) when the verify token matches, or the
 * subscription is rejected.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && expectedToken && token === expectedToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/**
 * Validates X-Hub-Signature-256 (format "sha256=<hex>") as HMAC-SHA256 of the
 * RAW request body, keyed with the Meta app secret. This is the same
 * verification Meta uses across all Graph API webhooks (Facebook, Instagram,
 * WhatsApp) and has been stable for years — unlike the WhatsApp-specific
 * payload shapes elsewhere in this file, this part didn't need live-doc
 * re-verification.
 */
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signatureHeader) return false;
  const expectedHex = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.replace(/^sha256=/, "");
  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

// Later statuses can arrive out of order (Meta doesn't guarantee delivery
// order of the sent/delivered/read webhooks) — never let an older status
// clobber a newer one that already landed.
const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 2 };

export async function POST(request: Request) {
  // Read the RAW body and verify BEFORE any JSON.parse — the signature covers
  // the exact bytes Meta sent, not a re-serialized object (same rule as the
  // Razorpay webhook in src/app/api/payments/webhook/route.ts).
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifySignature(rawBody, signature)) {
    console.warn("[whatsapp webhook] signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const statuses = payload.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.statuses ?? []) ?? []) ?? [];

  for (const status of statuses) {
    try {
      await recordStatus(status);
    } catch (err) {
      // Log and continue — one malformed status entry shouldn't fail the
      // whole batch, and Meta retries the delivery on a non-2xx response.
      console.error("[whatsapp webhook] failed to record status:", err);
    }
  }

  return NextResponse.json({ ok: true });
}

async function recordStatus(status: WhatsAppStatusEntry): Promise<void> {
  // biz_opaque_callback_data carries the requestId we set in whatsapp.ts's
  // send call (currently the 10-digit phone, see phoneAuth.ts) — use it to
  // find the matching verification doc without trusting recipient_id alone.
  const requestId = status.biz_opaque_callback_data;
  if (!requestId) return;

  const db = adminDb();
  const ref = db.collection("phoneVerifications").doc(requestId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return; // OTP doc already consumed/expired/deleted — nothing to annotate

    const existing = snap.data() as { waStatus?: string } | undefined;
    const existingRank = existing?.waStatus ? STATUS_RANK[existing.waStatus] ?? 0 : 0;
    const incomingRank = STATUS_RANK[status.status] ?? 0;
    if (incomingRank < existingRank) return; // don't regress a later status with an earlier one

    tx.set(
      ref,
      {
        waWamid: status.id,
        waStatus: status.status,
        waStatusAt: Date.now(),
        waErrorCode: status.errors?.[0]?.code ?? null,
      },
      { merge: true },
    );
  });
}
