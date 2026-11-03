/**
 * True for a plain `{ ... }` object literal (prototype is Object.prototype or
 * null) — false for arrays, and crucially false for any class instance, e.g.
 * Firestore's `FieldValue.serverTimestamp()` / `.increment()` / `.delete()`
 * sentinels or a `Timestamp`. Those sentinels carry no own enumerable
 * properties, so recursing into them like a plain object silently rebuilds
 * them as `{}` — losing their special meaning entirely (a serverTimestamp()
 * sentinel becomes a literal empty map written to Firestore, not "set this
 * field to the server's time"). Guarding on this lets sanitizeFirestoreData
 * skip anything that isn't a plain object and pass it through untouched.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively strips keys with `undefined` values from an object or array.
 * Firestore strictly rejects documents containing `undefined` property values.
 * Shared by client writes (src/lib/db.ts) and server-side writes
 * (src/lib/server/*) — kept dependency-free so either side can import it.
 *
 * Only recurses into plain object literals and arrays; anything else (a
 * Firestore FieldValue sentinel, a Timestamp, a Date, or any other class
 * instance) is returned as-is — see isPlainObject above for why.
 */
export function sanitizeFirestoreData<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeFirestoreData) as unknown as T;
  if (!isPlainObject(obj)) return obj;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = sanitizeFirestoreData(value);
    }
  }
  return cleaned as T;
}
