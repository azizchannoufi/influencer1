function env(name: string): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function stripWrappingQuotes(value: string): string {
  let key = value.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.trim();
}

function decodeBase64(b64: string): string {
  const bytes = Uint8Array.from(atob(b64), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Normalize private keys from Netlify / Cloudflare / CI env vars. */
export function resolvePrivateKey(): string {
  const b64Raw = env("FIREBASE_ADMIN_PRIVATE_KEY_BASE64");
  if (b64Raw) {
    const decoded = decodeBase64(stripWrappingQuotes(b64Raw).replace(/\s+/g, "")).trim();
    if (decoded.includes("BEGIN PRIVATE KEY")) return decoded;
    throw new Error(
      "FIREBASE_ADMIN_PRIVATE_KEY_BASE64 decoded but is not a valid PEM key",
    );
  }

  let key = stripWrappingQuotes(env("FIREBASE_ADMIN_PRIVATE_KEY"));
  // Hosts may store either real newlines or literal \n
  key = key.replace(/\\n/g, "\n");
  return key.trim();
}

export type ServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

export function readServiceAccount(): ServiceAccount | null {
  const projectId = env("FIREBASE_ADMIN_PROJECT_ID");
  const clientEmail = env("FIREBASE_ADMIN_CLIENT_EMAIL");
  if (!projectId || !clientEmail) return null;
  if (!env("FIREBASE_ADMIN_PRIVATE_KEY") && !env("FIREBASE_ADMIN_PRIVATE_KEY_BASE64")) {
    return null;
  }
  const privateKey = resolvePrivateKey();
  if (!privateKey.includes("BEGIN PRIVATE KEY")) return null;
  return { projectId, clientEmail, privateKey };
}
