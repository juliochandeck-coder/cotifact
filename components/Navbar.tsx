"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/summary", label: "Resumen", short: "Resum." },
  { href: "/dashboard", label: "Cotizaciones", short: "Cotiz." },
  { href: "/invoices", label: "Facturas", short: "Fact." },
  { href: "/followup", label: "Seguimiento", short: "Segui." },
  { href: "/directory", label: "Directorio", short: "Dir." },
  { href: "/settings", label: "Ajustes", short: "Ajust." },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  }

  // /quotes/... pertenece a la seccion Cotizaciones
  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname.startsWith("/quotes");
    }
    return pathname.startsWith(href);
  }

  return (
    <header className="no-print border-b border-line bg-paper sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <Link
          href="/summary"
          className="font-title font-bold text-ink text-lg tracking-tight shrink-0"
        >
          CotiFact
        </Link>

        <nav
          aria-label="Principal"
          className="flex items-center gap-1 sm:gap-3 min-w-0 overflow-x-auto"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`text-sm font-medium px-2 py-1 rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                isActive(link.href) ? "text-ink bg-ink/5" : "text-slate hover:text-ink"
              }`}
            >
              <span className="sm:hidden">{link.short}</span>
              <span className="hidden sm:inline">{link.label}</span>
            </Link>
          ))}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="btn-ghost text-sm px-2 py-1 shrink-0"
          >
            {signingOut ? "…" : "Salir"}
          </button>
        </nav>
      </div>
    </header>
  );
}
