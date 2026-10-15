"use client";

import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

const links = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: "dashboard",
    hint: "Overview",
  },
  {
    href: "/admin/settings",
    label: "General",
    icon: "settings",
    hint: "Contact & social",
  },
  {
    href: "/admin/homepage",
    label: "Homepage",
    icon: "home",
    hint: "Hero & sections",
  },
  {
    href: "/admin/about",
    label: "About",
    icon: "person",
    hint: "Bio & highlights",
  },
  {
    href: "/admin/portfolio",
    label: "Portfolio",
    icon: "photo_library",
    hint: "Projects & media",
  },
  {
    href: "/admin/services",
    label: "Services",
    icon: "scuba_diving",
    hint: "Training offers",
  },
  {
    href: "/admin/inbox",
    label: "Inbox",
    icon: "mail",
    hint: "Messages",
  },
  {
    href: "/admin/seo",
    label: "SEO",
    icon: "search",
    hint: "Search listings",
  },
];

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-1">
      {links.map((link) => {
        const active =
          link.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
              active
                ? "bg-surface-container-high text-on-surface"
                : "text-tertiary hover:bg-surface-container/60 hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined mt-0.5 text-[20px]">
              {link.icon}
            </span>
            <span>
              <span className="block text-sm font-medium">{link.label}</span>
              <span className="block text-[11px] opacity-70">{link.hint}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || loading) return;
    if (!user && pathname !== "/admin/login") {
      router.replace("/admin/login");
    }
  }, [mounted, loading, user, pathname, router]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  // Keep SSR + first client paint identical to avoid React #418 hydration errors.
  if (!mounted || (pathname !== "/admin/login" && loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-on-surface">
        Loading…
      </div>
    );
  }

  if (pathname === "/admin/login") return <>{children}</>;

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-on-surface">
        Redirecting to login…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-outline-variant/30 bg-surface-container-lowest/95 px-space-md py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls={navId}
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex size-10 items-center justify-center rounded-lg bg-surface-container-high text-on-surface"
        >
          <span className="material-symbols-outlined text-[22px]">
            {menuOpen ? "close" : "menu"}
          </span>
          <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="label-caps text-primary">Fares CMS</p>
          <p className="truncate text-xs text-tertiary">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => logout()}
          className="inline-flex size-10 items-center justify-center rounded-lg text-primary-container hover:bg-surface-container"
          aria-label="Logout"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
        </button>
      </header>

      {menuOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/55 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className="flex min-h-screen lg:min-h-screen">
        <aside
          id={navId}
          className={`fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col border-r border-outline-variant/30 bg-surface-container-lowest p-space-md transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-64 lg:shrink-0 lg:translate-x-0 ${
            menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="hidden lg:block">
            <p className="label-caps text-primary">Fares CMS</p>
            <p className="mt-1 truncate text-xs text-tertiary">{user.email}</p>
          </div>
          <div className="mb-space-md flex items-center justify-between lg:hidden">
            <p className="label-caps text-primary">Navigate</p>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="inline-flex size-9 items-center justify-center rounded-lg text-tertiary hover:bg-surface-container"
              aria-label="Close menu"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <div className="mt-0 flex min-h-0 flex-1 flex-col lg:mt-space-lg">
            <NavLinks pathname={pathname} onNavigate={() => setMenuOpen(false)} />
            <button
              type="button"
              onClick={() => logout()}
              className="mt-space-md hidden items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary-container hover:bg-surface-container lg:flex"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              Logout
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden p-space-md pb-28 sm:p-space-lg lg:p-space-xl lg:pb-space-xl">
          {children}
        </main>
      </div>
    </div>
  );
}
