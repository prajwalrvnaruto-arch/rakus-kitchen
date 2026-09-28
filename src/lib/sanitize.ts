/**
 * Recursively strips keys with `undefined` values from an object or array.
 * Firestore strictly rejects documents containing `undefined` property values.
 * Shared by client writes (src/lib/db.ts) and server-side writes
 * (src/lib/server/*) — kept dependency-free so either side can import it.
 */
export function sanitizeFirestoreData<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeFirestoreData) as unknown as T;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value !== undefined) {
      cleaned[key] = sanitizeFirestoreData(value);
    }
  }
  return cleaned as T;
}
