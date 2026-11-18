import "server-only";
import { NextResponse } from "next/server";
import { adminDb, verifyIdToken } from "./firebaseAdmin";

/**
 * Guards an API route so only kitchen staff (or an admin) can call it.
 *
 * Verifies the `Authorization: Bearer <idToken>` header with the Firebase Admin
 * SDK, then confirms the caller is on `/kitchenStaff/{uid}` OR `/admins/{uid}`
 * — the same two UID-keyed allowlists the client uses for `isKitchen || isAdmin`.
 * Returns either the authenticated uid, or a ready-to-return NextResponse
 * (401 missing/invalid token, 403 not kitchen staff).
 *
 * Usage in a route handler:
 *   const auth = await requireKitchen(request);
 *   if (auth instanceof NextResponse) return auth;
 *   // auth.uid is verified kitchen staff (or admin) from here on
 */
export async function requireKitchen(
  request: Request,
): Promise<{ uid: string } | NextResponse> {
  let uid: string;
  try {
    ({ uid } = await verifyIdToken(request.headers.get("authorization")));
  } catch {
    return NextResponse.json(
      { error: "Unauthorized — sign in as kitchen staff." },
      { status: 401 },
    );
  }

  try {
    const db = adminDb();
    const [kitchenSnap, adminSnap] = await Promise.all([
      db.collection("kitchenStaff").doc(uid).get(),
      db.collection("admins").doc(uid).get(),
    ]);
    if (!kitchenSnap.exists && !adminSnap.exists) {
      return NextResponse.json(
        { error: "Forbidden — your account is not on the kitchen staff list." },
        { status: 403 },
      );
    }
  } catch (err) {
    // A Firestore read failure here is a server problem, not an auth decision.
    return NextResponse.json(
      { error: `Kitchen access check failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  return { uid };
}
