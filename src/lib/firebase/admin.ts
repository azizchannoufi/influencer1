import { resolvePrivateKey } from "@/lib/firebase/service-account";

type AdminApp = import("firebase-admin/app").App;

let adminApp: AdminApp | null = null;
let initFailed = false;
let initError: string | null = null;

export function getFirebaseAdminInitError() {
  return initError;
}

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      (process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
        process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64),
  );
}

/**
 * Loaded on demand. A top-level import crashes Cloudflare Workers
 * (protobufjs calls new Function, which workerd forbids).
 */
async function loadAdminAppSdk() {
  return import("firebase-admin/app");
}

export async function getAdminApp(): Promise<AdminApp | null> {
  if (!isFirebaseAdminConfigured() || initFailed) return null;
  if (adminApp) return adminApp;
  try {
    const { cert, getApps, initializeApp } = await loadAdminAppSdk();
    const existing = getApps()[0];
    if (existing) {
      adminApp = existing;
      return adminApp;
    }
    const privateKey = resolvePrivateKey();
    if (!privateKey.includes("BEGIN PRIVATE KEY")) {
      throw new Error(
        "FIREBASE_ADMIN_PRIVATE_KEY is missing BEGIN PRIVATE KEY header. Prefer FIREBASE_ADMIN_PRIVATE_KEY_BASE64 on Netlify.",
      );
    }
    adminApp = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
        privateKey,
      }),
    });
    return adminApp;
  } catch (error) {
    initFailed = true;
    initError = error instanceof Error ? error.message : String(error);
    console.error("[firebase-admin] Failed to initialize:", error);
    return null;
  }
}

export async function getAdminDb() {
  const app = await getAdminApp();
  if (!app) return null;
  try {
    const { getFirestore } = await import("firebase-admin/firestore");
    return getFirestore(app);
  } catch (error) {
    initError = error instanceof Error ? error.message : String(error);
    console.error("[firebase-admin] Firestore unavailable:", error);
    return null;
  }
}

export async function getAdminAuth() {
  const app = await getAdminApp();
  if (!app) return null;
  try {
    const { getAuth } = await import("firebase-admin/auth");
    return getAuth(app);
  } catch (error) {
    initError = error instanceof Error ? error.message : String(error);
    console.error("[firebase-admin] Auth unavailable:", error);
    return null;
  }
}
