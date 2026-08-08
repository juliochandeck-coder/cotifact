/**
 * PostgREST puede devolver columnas `numeric` como string.
 * Todo valor monetario pasa por aqui antes de usarse en matematicas o formato.
 */
export function num(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Redondeo a 2 decimales sin errores de punto flotante (0.1 + 0.2 = 0.3). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatMoney(value: unknown, currency = "MXN", locale = "es-MX"): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num(value));
  } catch {
    return `$${num(value).toFixed(2)}`;
  }
}

export function formatDate(value: string | null | undefined, locale = "es-MX"): string | null {
  if (!value) return null;
  // Fechas tipo `date` (YYYY-MM-DD) se interpretan como UTC y pueden
  // mostrarse un dia antes. Se fuerza la lectura local.
  const parts = value.slice(0, 10).split("-").map(Number);
  const d =
    parts.length === 3 && !Number.isNaN(parts[0])
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

/** Calcula totales de una lista de conceptos con redondeo consistente. */
export function computeTotals(
  items: { quantity: number; unit_price: number }[],
  taxRate: number
) {
  const subtotal = round2(
    items.reduce((sum, it) => sum + num(it.quantity) * num(it.unit_price), 0)
  );
  const taxAmount = round2(subtotal * (num(taxRate) / 100));
  const total = round2(subtotal + taxAmount);
  return { subtotal, taxAmount, total };
}

/**
 * Luminancia relativa (WCAG). Se usa para avisar al usuario si su color de
 * marca deja el texto ilegible sobre blanco, y para decidir texto claro/oscuro
 * sobre bloques de color.
 */
export function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return 0;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

/** Contraste WCAG contra blanco. Menor a 3 es problematico para texto. */
export function contrastOnWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return `rgba(20, 33, 61, ${alpha})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function isValidHex(hex: string | null | undefined): hex is string {
  if (!hex) return false;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);
}

/**
 * PostgREST interpreta comas, parentesis y comillas como sintaxis de filtro.
 * Un cliente llamado "Gomez, S.A. (MX)" romperia la consulta si se pasa crudo.
 */
export function sanitizeSearch(input: string): string {
  return input.replace(/[,()\\"'*%]/g, " ").trim().slice(0, 80);
}
