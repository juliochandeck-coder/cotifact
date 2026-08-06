"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Props = {
  statuses: string[];
  labels: Record<string, string>;
  placeholder: string;
};

export default function ListFilters({ statuses, labels, placeholder }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const status = searchParams.get("status") ?? "";

  // Debounce: no se lanza una consulta por cada tecla.
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (q === current) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (q) params.set("q", q);
      else params.delete("q");
      params.delete("page");
      startTransition(() => router.replace(`${pathname}?${params.toString()}`));
    }, 350);

    return () => clearTimeout(timer);
  }, [q, pathname, router, searchParams]);

  function setStatus(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("status", next);
    else params.delete("status");
    params.delete("page");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="no-print flex flex-col sm:flex-row gap-3 mb-4">
      <div className="flex-1">
        <label htmlFor="search" className="sr-only">
          Buscar
        </label>
        <input
          id="search"
          type="search"
          className="field-input"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="statusFilter" className="sr-only">
          Filtrar por estado
        </label>
        <select
          id="statusFilter"
          className="field-input sm:w-48 cursor-pointer"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {labels[s]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
