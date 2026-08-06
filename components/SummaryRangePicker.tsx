"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SummaryRangePreset } from "@/types";

const PRESETS: { value: SummaryRangePreset; label: string }[] = [
  { value: "month", label: "Este mes" },
  { value: "quarter", label: "Últimos 3 meses" },
  { value: "year", label: "Este año" },
  { value: "custom", label: "Rango personalizado" },
];

export default function SummaryRangePicker({ current }: { current: SummaryRangePreset }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setPreset(preset: SummaryRangePreset) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", preset);
    if (preset !== "custom") {
      params.delete("from");
      params.delete("to");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function setCustom(field: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", "custom");
    params.set(field, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      <div className="flex flex-wrap gap-1 rounded-sm border border-line bg-white p-1">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPreset(p.value)}
            aria-current={current === p.value ? "true" : undefined}
            className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
              current === p.value ? "bg-ink text-paper" : "text-slate hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {current === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="field-input py-1.5 text-xs w-auto"
            defaultValue={searchParams.get("from") ?? ""}
            onChange={(e) => setCustom("from", e.target.value)}
            aria-label="Desde"
          />
          <span className="text-xs text-slate">a</span>
          <input
            type="date"
            className="field-input py-1.5 text-xs w-auto"
            defaultValue={searchParams.get("to") ?? ""}
            onChange={(e) => setCustom("to", e.target.value)}
            aria-label="Hasta"
          />
        </div>
      )}
    </div>
  );
}
