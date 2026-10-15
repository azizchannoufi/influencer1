import type { Metadata } from "next";
import "./globals.css";

function metadataBaseUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    try {
      return new URL(raw.includes("://") ? raw : `https://${raw}`);
    } catch {
      // Ignore a malformed site URL so the layout can still render.
    }
  }
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl(),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return children;
}
