/**
 * Tiny cross-component flag for a deliberate sign-out from inside /kitchen.
 *
 * When the kitchen header's "Sign out" runs, auth goes null while the
 * KitchenGate is still mounted on /kitchen, so the gate's "signed-out →
 * /login" redirect would fire and cancel the header's navigation to "/".
 * The header raises this flag first; the gate checks it and stands down, so
 * the sign-out lands on "/" as intended. It auto-clears so a later genuine
 * signed-out visit to /kitchen is still redirected to login.
 */
let signingOut = false;

/** Raise the flag for a short window around a deliberate kitchen sign-out. */
export function beginKitchenSignOut(): void {
  signingOut = true;
  // Clear after the navigation has had time to commit. Long enough to outlast
  // the auth-state change + route transition, short enough that a real
  // signed-out visit moments later still redirects to login.
  setTimeout(() => {
    signingOut = false;
  }, 2000);
}

export function isKitchenSigningOut(): boolean {
  return signingOut;
}
