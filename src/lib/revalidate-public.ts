import { revalidatePath } from "next/cache";

/** Drop the cached public pages so the next visit reads Firestore. */
export function revalidatePublicContent() {
  revalidatePath("/en", "layout");
  revalidatePath("/fr", "layout");
}
