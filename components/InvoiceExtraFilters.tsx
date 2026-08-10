"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export default function InvoiceExtraFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const dgi = searchParams.get("dgi") ?? "";
  const retainer = searchParams.get("retainer") ?? "";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="no-print flex flex-wrap gap-3 mb-4 -mt-1">
      <select
        aria-label="Filtrar por factura fiscal"
        className="field-input w-auto text-xs py-1.5 cursor-pointer"
        value={dgi}
        onChange={(e) => setParam("dgi", e.target.value)}
      >
        <option value="">DGI: todas</option>
        <option value="yes">Requieren DGI</option>
        <option value="no">No requieren DGI</option>
      </select>
      <select
        aria-label="Filtrar por retainer"
        className="field-input w-auto text-xs py-1.5 cursor-pointer"
        value={retainer}
        onChange={(e) => setParam("retainer", e.target.value)}
      >
        <option value="">Todas las facturas</option>
        <option value="yes">Solo retainers</option>
      </select>
    </div>
  );
}
