import {
  defaultAboutSettings,
  defaultGeneralSettings,
  defaultHomepageSettings,
  defaultPortfolioItems,
  defaultServices,
} from "@/lib/data/defaults";
import { formatFirestoreAdminError } from "@/lib/firebase/firestore-errors";
import {
  getPublicCollection,
  getPublicDoc,
} from "@/lib/firebase/firestore-rest";
import type {
  AboutSettings,
  ContactMessage,
  GeneralSettings,
  HomepageSettings,
  PageSeo,
  PortfolioItem,
  ServiceItem,
  TrainingRegistration,
} from "@/types/cms";

async function adminDb() {
  const { getAdminDb } = await import("@/lib/firebase/admin");
  return getAdminDb();
}

/** Strip Firestore Timestamps / class instances for RSC → client props. */
function toClientJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (v && typeof v === "object" && typeof (v as { toDate?: unknown }).toDate === "function") {
        try {
          return (v as { toDate: () => Date }).toDate().toISOString();
        } catch {
          return null;
        }
      }
      return v;
    }),
  ) as T;
}

async function readAdminDoc<T>(path: string, fallback: T): Promise<T | null> {
  const db = await adminDb();
  if (!db) return null;
  const snap = await db.doc(path).get();
  if (!snap.exists) return toClientJson(fallback);
  return toClientJson({ ...fallback, ...(snap.data() as object) } as T);
}

async function getDoc<T>(path: string, fallback: T): Promise<T> {
  try {
    const data = await getPublicDoc(path);
    if (data) return toClientJson({ ...fallback, ...data } as T);
  } catch (error) {
    console.error(`[content] getDoc ${path} failed:`, error);
  }

  try {
    const adminData = await readAdminDoc(path, fallback);
    if (adminData) return adminData;
  } catch (error) {
    console.error(`[content] getDoc ${path} admin failed:`, error);
  }
  return toClientJson(fallback);
}

async function getCollection<T extends { id: string }>(
  name: string,
  fallback: T[],
  filter?: (item: T) => boolean,
): Promise<T[]> {
  const useFallback = () => {
    const list = filter ? fallback.filter(filter) : fallback;
    return toClientJson(list);
  };

  // Published public lists go through REST so the homepage never loads firebase-admin.
  if (filter) {
    try {
      const remote = await getPublicCollection<T>(name, { publishedOnly: true });
      if (remote && remote.length > 0) {
        return toClientJson(remote.filter(filter));
      }
    } catch (error) {
      console.error(`[content] getCollection ${name} failed:`, error);
    }
  }

  const db = await adminDb();
  if (!db) return useFallback();
  try {
    const snap = await db.collection(name).get();
    if (snap.empty) return useFallback();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
    const list = filter ? items.filter(filter) : items;
    if (list.length === 0) return useFallback();
    return toClientJson(list);
  } catch (error) {
    console.error(`[content] getCollection ${name} failed:`, error);
    return useFallback();
  }
}

export async function getGeneralSettings(): Promise<GeneralSettings> {
  const data = await getDoc("settings/general", defaultGeneralSettings);
  return toClientJson({
    ...defaultGeneralSettings,
    ...data,
    social: {
      ...defaultGeneralSettings.social,
      ...data.social,
    },
  });
}

export async function getHomepageSettings(): Promise<HomepageSettings> {
  const data = await getDoc("settings/homepage", defaultHomepageSettings);
  return toClientJson({
    ...defaultHomepageSettings,
    ...data,
    heroPills: data.heroPills ?? defaultHomepageSettings.heroPills,
    stats: data.stats ?? defaultHomepageSettings.stats,
    collaborationCards:
      data.collaborationCards ?? defaultHomepageSettings.collaborationCards,
    whyWorkPillars: data.whyWorkPillars ?? defaultHomepageSettings.whyWorkPillars,
    featuredPortfolioIds:
      data.featuredPortfolioIds ?? defaultHomepageSettings.featuredPortfolioIds,
  });
}

export async function getAboutSettings(): Promise<AboutSettings> {
  const data = await getDoc("settings/about", defaultAboutSettings);
  return toClientJson({
    ...defaultAboutSettings,
    ...data,
    highlights: data.highlights ?? defaultAboutSettings.highlights,
  });
}

export async function getPublishedPortfolio(): Promise<PortfolioItem[]> {
  const items = await getCollection<PortfolioItem>(
    "portfolio",
    defaultPortfolioItems,
    (i) => i.published,
  );
  return [...items].sort((a, b) => a.order - b.order);
}

export async function getAllPortfolioAdmin(): Promise<PortfolioItem[]> {
  return getCollection<PortfolioItem>("portfolio", defaultPortfolioItems);
}

export async function getPublishedServices(): Promise<ServiceItem[]> {
  const items = await getCollection<ServiceItem>(
    "services",
    defaultServices,
    (s) => s.published,
  );
  return [...items].sort((a, b) => a.order - b.order);
}

export async function getAllServicesAdmin(): Promise<ServiceItem[]> {
  return getCollection<ServiceItem>("services", defaultServices);
}

export async function getServiceBySlug(slug: string): Promise<ServiceItem | null> {
  const services = await getPublishedServices();
  return services.find((s) => s.slug === slug) ?? null;
}

export async function getPageSeo(pageKey: string): Promise<PageSeo | null> {
  try {
    const data = await getPublicDoc(`seoPages/${pageKey}`);
    if (!data) return null;
    return toClientJson(data as PageSeo);
  } catch {
    return null;
  }
}

export async function getMessagesAdmin(): Promise<ContactMessage[]> {
  const db = await adminDb();
  if (!db) return [];
  try {
    const snap = await db
      .collection("messages")
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();
    return toClientJson(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ContactMessage),
    );
  } catch {
    return [];
  }
}

export async function getRegistrationsAdmin(): Promise<TrainingRegistration[]> {
  const db = await adminDb();
  if (!db) return [];
  try {
    const snap = await db
      .collection("registrations")
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();
    return toClientJson(
      snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as TrainingRegistration,
      ),
    );
  } catch {
    return [];
  }
}

export async function saveSettingsDoc(path: string, data: object) {
  const db = await adminDb();
  if (!db) throw new Error("Firebase Admin is not configured");
  try {
    await db.doc(path).set(data, { merge: true });
  } catch (error) {
    throw new Error(formatFirestoreAdminError(error));
  }
}

export async function saveCollectionDoc(
  collection: string,
  id: string,
  data: object,
) {
  const db = await adminDb();
  if (!db) throw new Error("Firebase Admin is not configured");
  try {
    await db.collection(collection).doc(id).set(data, { merge: true });
  } catch (error) {
    throw new Error(formatFirestoreAdminError(error));
  }
}

export async function deleteCollectionDoc(collection: string, id: string) {
  const db = await adminDb();
  if (!db) throw new Error("Firebase Admin is not configured");
  try {
    await db.collection(collection).doc(id).delete();
  } catch (error) {
    throw new Error(formatFirestoreAdminError(error));
  }
}

/** Lightweight probe used by /api/admin/health. */
export async function probeFirestore(): Promise<{
  ok: boolean;
  error: string | null;
}> {
  const db = await adminDb();
  if (!db) {
    return { ok: false, error: "Firebase Admin is not configured" };
  }
  try {
    await db.doc("_health/ping").get();
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: formatFirestoreAdminError(error) };
  }
}
