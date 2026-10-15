import { getFirestoreAccessToken } from "@/lib/firebase/google-access-token";

/**
 * Firestore reads over HTTPS.
 * firebase-admin uses gRPC and protobuf code generation, which Cloudflare
 * Workers reject. A service-account token uses the same access as the Admin SDK.
 */

type FirestoreValue = {
  nullValue?: null;
  booleanValue?: boolean;
  integerValue?: string | number;
  doubleValue?: number;
  timestampValue?: string;
  stringValue?: string;
  bytesValue?: string;
  referenceValue?: string;
  geoPointValue?: { latitude: number; longitude: number };
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
};

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
};

function env(name: string): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function projectId(): string {
  return env("FIREBASE_ADMIN_PROJECT_ID") || env("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
}

function decodeValue(value: FirestoreValue | undefined): unknown {
  if (!value || typeof value !== "object") return null;
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue ?? "";
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue ?? null;
  if ("bytesValue" in value) return value.bytesValue ?? null;
  if ("referenceValue" in value) return value.referenceValue ?? null;
  if ("geoPointValue" in value) return value.geoPointValue ?? null;
  if ("arrayValue" in value) {
    return (value.arrayValue?.values ?? []).map((entry) => decodeValue(entry));
  }
  if ("mapValue" in value) return decodeFields(value.mapValue?.fields);
  return null;
}

function decodeFields(
  fields: Record<string, FirestoreValue> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!fields) return out;
  for (const [key, value] of Object.entries(fields)) {
    out[key] = decodeValue(value);
  }
  return out;
}

function documentId(name: string | undefined): string {
  if (!name) return "";
  const slash = name.lastIndexOf("/");
  return slash >= 0 ? name.slice(slash + 1) : name;
}

function restUrl(resource: string): string | null {
  const id = projectId();
  if (!id) return null;
  return `https://firestore.googleapis.com/v1/projects/${id}/databases/(default)/${resource}`;
}

async function firestoreFetch(
  resource: string,
  init?: RequestInit,
): Promise<Response | null> {
  const url = restUrl(resource);
  if (!url) return null;
  const headers = new Headers(init?.headers);
  const token = await getFirestoreAccessToken();
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  } else {
    const apiKey = env("NEXT_PUBLIC_FIREBASE_API_KEY");
    if (!apiKey) return null;
    const withKey = new URL(url);
    withKey.searchParams.set("key", apiKey);
    return fetch(withKey, { ...init, headers, cache: "no-store" });
  }
  return fetch(url, { ...init, headers, cache: "no-store" });
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { status?: string; message?: string };
    };
    return body.error?.status || body.error?.message || response.statusText;
  } catch {
    return response.statusText;
  }
}

/** Returns null when Firebase is not configured, the doc is missing, or the read fails. */
export async function getPublicDoc(
  path: string,
): Promise<Record<string, unknown> | null> {
  const response = await firestoreFetch(`documents/${path}`);
  if (!response) return null;
  if (response.status === 404) return null;
  if (!response.ok) {
    console.error(
      `[firestore] get ${path} failed: ${response.status} ${await readError(response)}`,
    );
    return null;
  }
  const doc = (await response.json()) as FirestoreDocument;
  return decodeFields(doc.fields);
}

/**
 * Lists a collection. publishedOnly limits portfolio/services to public items.
 * Returns null when Firebase is not configured or the read fails.
 */
export async function getPublicCollection<T extends { id: string }>(
  collectionId: string,
  options?: { publishedOnly?: boolean },
): Promise<T[] | null> {
  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId }],
    limit: 200,
  };
  if (options?.publishedOnly) {
    structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: "published" },
        op: "EQUAL",
        value: { booleanValue: true },
      },
    };
  }

  const response = await firestoreFetch("documents:runQuery", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!response) return null;
  if (!response.ok) {
    console.error(
      `[firestore] list ${collectionId} failed: ${response.status} ${await readError(response)}`,
    );
    return null;
  }

  const rows = (await response.json()) as { document?: FirestoreDocument }[];
  return rows
    .filter((row) => row.document?.name)
    .map((row) => {
      const doc = row.document as FirestoreDocument;
      return {
        id: documentId(doc.name),
        ...decodeFields(doc.fields),
      } as T;
    });
}
