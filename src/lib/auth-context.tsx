"use client";

import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { retryingListener } from "./db";

interface AuthState {
  /** true while we're still restoring session state. */
  loading: boolean;
  user: User | null;
  isAdmin: boolean;
  /** true if this account is on the /kitchenStaff allowlist — read-only access
   *  to the combined daily prep sheet at /kitchen. Independent of isAdmin;
   *  admins are not automatically kitchen staff in this flag (though they can
   *  still open /kitchen — KitchenGate checks isKitchen || isAdmin). */
  isKitchen: boolean;
  /** false until BOTH the /admins and /kitchenStaff listeners have reported at
   *  least once for the current signed-in user. Lets a gate tell "not authorized"
   *  apart from "not checked yet" and avoid flashing a lock screen while the
   *  allowlist flags are still arriving. Always true when there is no user. */
  accessResolved: boolean;
}

const AuthContext = createContext<AuthState>({ loading: true, user: null, isAdmin: false, isKitchen: false, accessResolved: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isKitchen, setIsKitchen] = useState(false);
  // Each flag flips true once its allowlist listener has reported for the
  // current user; both reset to false whenever the user changes.
  const [adminResolved, setAdminResolved] = useState(false);
  const [kitchenResolved, setKitchenResolved] = useState(false);

  // Restore the signed-in user (persisted by Firebase across page loads).
  useEffect(() => {
    if (!auth) {
      // Firebase not configured — don't leave the app stuck on "Loading…".
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Admins are granted by a Firestore allowlist doc /admins/{uid}.
  // Subscribing only while a user is signed in; re-subscribes on user change.
  // Wrapped in retryingListener so a cold page load racing auth-token restore
  // (or a rules-propagation window) recovers on its own instead of sticking
  // isAdmin at false for the rest of the session.
  useEffect(() => {
    setAdminResolved(false);
    if (!db || !user?.uid) {
      setIsAdmin(false);
      // No user (or no Firestore) means there is nothing to resolve — a gate
      // should treat access as settled, not wait forever on the loader.
      if (!user?.uid) setAdminResolved(true);
      return undefined;
    }
    // Capture the narrowed (non-null) values so they survive the retrying-listener closure.
    const firestore = db;
    const uid = user.uid;
    return retryingListener(
      `admins:${uid}`,
      (onSnapshotError) =>
        onSnapshot(
          doc(firestore, "admins", uid),
          (snap) => {
            setIsAdmin(snap.exists());
            setAdminResolved(true);
          },
          onSnapshotError,
        ),
      (err) => console.warn("admins snapshot: error (non-fatal):", err),
    );
  }, [user?.uid]);

  // Kitchen staff are granted by a separate Firestore allowlist doc
  // /kitchenStaff/{uid} — entirely independent of /admins. Same live-listener
  // + retry pattern as isAdmin above.
  useEffect(() => {
    setKitchenResolved(false);
    if (!db || !user?.uid) {
      setIsKitchen(false);
      if (!user?.uid) setKitchenResolved(true);
      return undefined;
    }
    const firestore = db;
    const uid = user.uid;
    return retryingListener(
      `kitchenStaff:${uid}`,
      (onSnapshotError) =>
        onSnapshot(
          doc(firestore, "kitchenStaff", uid),
          (snap) => {
            setIsKitchen(snap.exists());
            setKitchenResolved(true);
          },
          onSnapshotError,
        ),
      (err) => console.warn("kitchenStaff snapshot: error (non-fatal):", err),
    );
  }, [user?.uid]);

  const accessResolved = adminResolved && kitchenResolved;

  return (
    <AuthContext.Provider value={{ loading, user, isAdmin, isKitchen, accessResolved }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);