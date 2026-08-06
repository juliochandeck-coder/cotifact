import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/format";

/** Escapa un valor para CSV: comillas dobles y separadores no rompen la columna. */
function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Exporta cotizaciones o facturas a CSV. El contador lo pide el primer mes,
 * y poder sacar tus datos evita que la herramienta se sienta una jaula.
 */
export async function GET(request: NextRequest) {
  const kind = new URL(request.url).searchParams.get("kind") === "invoices" ? "invoices" : "quotes";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const isInvoice = kind === "invoices";
  const { data, error } = await supabase
    .from(isInvoice ? "invoices" : "quotes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "No se pudieron leer los datos." }, { status: 500 });
  }

  const header = [
    "numero",
    "fecha",
    isInvoice ? "vence" : "valida_hasta",
    "cliente",
    "empresa",
    "correo",
    "telefono",
    "estado",
    "subtotal",
    "impuesto_pct",
    "impuesto",
    "total",
    "conceptos",
  ];

  const rows = (data ?? []).map((d: Record<string, unknown>) => {
    const items = Array.isArray(d.items) ? d.items : [];
    const detail = items
      .map(
        (i: { description?: string; quantity?: unknown; unit_price?: unknown }) =>
          `${i.description} x${num(i.quantity)} @ ${num(i.unit_price)}`
      )
      .join(" | ");

    return [
      d[isInvoice ? "invoice_number" : "quote_number"],
      String(d.created_at ?? "").slice(0, 10),
      d[isInvoice ? "due_date" : "valid_until"] ?? "",
      d.client_name,
      d.client_company ?? "",
      d.client_email ?? "",
      d.client_phone ?? "",
      d.status,
      num(d.subtotal).toFixed(2),
      num(d.tax_rate),
      num(d.tax_amount).toFixed(2),
      num(d.total).toFixed(2),
      detail,
    ]
      .map(cell)
      .join(",");
  });

  // BOM para que Excel abra los acentos correctamente
  const csv = "\uFEFF" + [header.join(","), ...rows].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cotifact-${kind}-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
