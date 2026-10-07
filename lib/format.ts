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

/**
 * Fecha como en los documentos impresos: "04-09-2026" (dd-mm-aaaa).
 * Las fechas `date` (YYYY-MM-DD) se leen tal cual; los timestamps se pasan
 * a hora local para que un documento creado de noche no salga con el dia siguiente.
 */
export function formatDateDMY(value: string | null | undefined): string {
  if (!value) return "";
  let d: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [y, m, day] = value.trim().split("-").map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(value);
  }
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/**
 * Nombre de archivo del PDF, con el mismo patron que los documentos originales:
 *   Factura_Julio_Chandeck_Mendó_Coffee_Co._Septiembre_2026
 *   04092026_Jardines_Urbanos_Cotización_Julio_Chandeck_Septiembre_2026
 */
export function documentFilename(
  kind: "quote" | "invoice",
  opts: { issuer: string | null | undefined; client: string; date: string | null | undefined }
): string {
  const d = opts.date ? new Date(opts.date) : new Date();
  const valid = !Number.isNaN(d.getTime());
  const month = valid ? `${MESES[d.getMonth()]} ${d.getFullYear()}` : "";
  const issuer = (opts.issuer ?? "").trim().split(/\s+/).slice(0, 2).join(" ");
  const parts =
    kind === "invoice"
      ? ["Factura", issuer, opts.client, month]
      : [formatDateDMY(opts.date).replace(/-/g, ""), opts.client, "Cotización", issuer, month];
  return parts
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_");
}
