import { readServiceAccount } from "@/lib/firebase/service-account";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/datastore";

let cached: { token: string; expiresAt: number } | null = null;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlJson(value: object): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const raw = Uint8Array.from(atob(b64), (char) => char.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/** Service-account token for the Firestore REST API. Null when admin env is missing. */
export async function getFirestoreAccessToken(): Promise<string | null> {
  try {
    const account = readServiceAccount();
    if (!account) return null;
    const now = Math.floor(Date.now() / 1000);
    if (cached && cached.expiresAt > now + 60) return cached.token;

    const unsigned = `${base64UrlJson({ alg: "RS256", typ: "JWT" })}.${base64UrlJson({
      iss: account.clientEmail,
      sub: account.clientEmail,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
      scope: SCOPE,
    })}`;
    const key = await importPrivateKey(account.privateKey);
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsigned),
    );
    const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(`[firestore] access token failed: ${response.status}`);
      return null;
    }
    const json = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) return null;
    cached = {
      token: json.access_token,
      expiresAt: now + (json.expires_in ?? 3600),
    };
    return json.access_token;
  } catch (error) {
    console.error(
      "[firestore] access token failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return null;
  }
}
