import { SupabaseClient } from "@supabase/supabase-js";

/**
 * La numeracion de cotizaciones y facturas es MANUAL: el usuario escribe
 * siempre el numero. Esto solo ayuda a recordarle cual fue el ultimo.
 */

type Kind = "quote" | "invoice";

const TABLE: Record<Kind, { table: string; column: string; label: string }> = {
  quote: { table: "quotes", column: "quote_number", label: "cotización" },
  invoice: { table: "invoices", column: "invoice_number", label: "factura" },
};

/** Número más alto usado hasta ahora (por sus dígitos finales), o null si no hay. */
export async function lastUsedNumber(
  supabase: SupabaseClient,
  kind: Kind
): Promise<string | null> {
  const { table, column } = TABLE[kind];
  const { data } = await supabase
    .from(table)
    .select(column)
    .order("created_at", { ascending: false })
    .limit(300);

  let best: { n: number; raw: string } | null = null;
  for (const row of (data ?? []) as unknown as Record<string, string>[]) {
    const raw = String(row[column] ?? "").trim();
    const m = raw.match(/(\d+)\s*$/);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (!best || n > best.n) best = { n, raw };
  }
  return best?.raw ?? null;
}

/**
 * Pide el número al usuario. Devuelve null si cancela.
 * No se acepta vacío: la numeración nunca se asigna sola.
 */
export async function askDocumentNumber(
  supabase: SupabaseClient,
  kind: Kind,
  context?: string
): Promise<string | null> {
  const { label } = TABLE[kind];
  const last = await lastUsedNumber(supabase, kind);
  const hint = last ? ` (la última fue ${last})` : "";
  const question = `${context ? context + "\n\n" : ""}Número de ${label}${hint}:`;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const answer = window.prompt(question, "");
    if (answer === null) return null;
    const trimmed = answer.trim();
    if (trimmed) return trimmed;
    window.alert(`Escribe el número de ${label}.`);
  }
}

export const DUPLICATE_NUMBER_CODE = "23505";

/** Forma de pago de la factura más reciente que tenga una (para no reescribirla cada vez). */
export async function lastPaymentMethod(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("invoices")
    .select("payment_method")
    .not("payment_method", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const pm = (data as { payment_method?: string | null } | null)?.payment_method ?? null;
  return pm && pm.trim() ? pm : null;
}
