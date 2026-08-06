import { SummaryRangePreset } from "@/types";

export type DateRange = { from: string; to: string; label: string };

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Calcula el rango [from, to] para un preset, y el rango equivalente anterior
 * (misma duración, inmediatamente antes) para poder mostrar la tendencia.
 */
export function computeRange(
  preset: SummaryRangePreset,
  customFrom?: string,
  customTo?: string
): { current: DateRange; previous: DateRange } {
  const now = new Date();
  let from: Date;
  let to: Date = now;
  let label: string;

  if (preset === "custom" && customFrom && customTo) {
    from = new Date(customFrom + "T00:00:00");
    to = new Date(customTo + "T00:00:00");
    label = "Rango personalizado";
  } else if (preset === "quarter") {
    from = new Date(now);
    from.setMonth(from.getMonth() - 3);
    label = "Últimos 3 meses";
  } else if (preset === "year") {
    from = new Date(now.getFullYear(), 0, 1);
    label = "Este año";
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    label = "Este mes";
  }

  const spanMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 86_400_000); // el dia justo antes
  const prevFrom = new Date(prevTo.getTime() - spanMs);

  return {
    current: { from: toISODate(from), to: toISODate(to), label },
    previous: { from: toISODate(prevFrom), to: toISODate(prevTo), label: "Período anterior" },
  };
}

/** % de cambio entre dos valores, null si no hay base para comparar. */
export function trend(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : null;
  return ((current - previous) / previous) * 100;
}
