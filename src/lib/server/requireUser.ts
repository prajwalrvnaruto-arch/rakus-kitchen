import "server-only";
import { NextResponse } from "next/server";
import { verifyIdToken } from "./firebaseAdmin";

/**
 * Guards an API route so only a signed-in user (any account, not just admins)
 * can call it. Verifies the `Authorization: Bearer <idToken>` header with the
 * Firebase Admin SDK; returns the authenticated uid, or a ready-to-return 401.
 *
 * Used to close routes that proxy a billable third-party call (Ola Maps) so an
 * anonymous attacker can't hit them directly — the client debounce is UI, not a
 * security boundary. Address entry only happens mid-checkout, where the user is
 * signed in anyway, so requiring a token here costs a real customer nothing.
 *
 * Usage:
 *   const auth = await requireUser(request);
 *   if (auth instanceof NextResponse) return auth;
 *   // auth.uid is a verified signed-in user from here on
 */
export async function requireUser(
  request: Request,
): Promise<{ uid: string } | NextResponse> {
  try {
    const { uid } = await verifyIdToken(request.headers.get("authorization"));
    return { uid };
  } catch {
    return NextResponse.json(
      { error: "Unauthorized — please sign in." },
      { status: 401 },
    );
  }
}
