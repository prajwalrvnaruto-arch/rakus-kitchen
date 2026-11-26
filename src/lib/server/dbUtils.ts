import "server-only";
import { adminDb } from "./firebaseAdmin";
import type { Order } from "@/types";

/**
 * Fetch a single order by its Firestore document ID.
 * Returns null if not found.
 */
export async function getOrderById(docId: string): Promise<Order | null> {
  const doc = await adminDb().collection("orders").doc(docId).get();

  if (!doc.exists) return null;

  return { id: doc.id, ...doc.data() } as Order;
}
