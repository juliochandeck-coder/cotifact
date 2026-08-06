import { SupabaseClient } from "@supabase/supabase-js";
import { Quote, CompanySettings } from "@/types";

export type CreateInvoiceResult =
  | { ok: true; id: string; number: string }
  | { ok: false; message: string; duplicate?: boolean };

/**
 * Crea una factura a partir de una cotizacion aprobada.
 * Se usa desde el detalle de la cotizacion y desde el boton rapido del listado,
 * para que la logica de numeracion y copia de datos viva en un solo sitio.
 */
export async function createInvoiceFromQuote(
  supabase: SupabaseClient,
  quote: Quote,
  company: CompanySettings | null
): Promise<CreateInvoiceResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  // Numero atomico desde Postgres: no se repite ni con clics simultaneos.
  const { data: invoiceNumber, error: numberError } = await supabase.rpc(
    "next_document_number",
    { p_prefix: "INV" }
  );

  if (numberError || !invoiceNumber) {
    return {
      ok: false,
      message: "No se pudo asignar el número de factura. " + (numberError?.message ?? ""),
    };
  }

  const termDays = company?.payment_terms_days ?? 15;
  const due = new Date();
  due.setDate(due.getDate() + termDays);

  const { data, error: insertError } = await supabase
    .from("invoices")
    .insert({
      quote_id: quote.id,
      user_id: user.id,
      invoice_number: invoiceNumber,
      client_name: quote.client_name,
      client_company: quote.client_company,
      client_email: quote.client_email,
      client_phone: quote.client_phone,
      items: quote.items,
      subtotal: quote.subtotal,
      tax_rate: quote.tax_rate,
      tax_amount: quote.tax_amount,
      total: quote.total,
      notes: quote.notes,
      due_date: due.toISOString().slice(0, 10),
      status: "pendiente",
    })
    .select("id, invoice_number")
    .single();

  if (insertError || !data) {
    // 23505 = indice unico: ya existe factura para esta cotizacion.
    if (insertError?.code === "23505") {
      return {
        ok: false,
        duplicate: true,
        message: "Esta cotización ya tiene una factura. Recarga la página para verla.",
      };
    }
    return {
      ok: false,
      message: "No se pudo generar la factura. " + (insertError?.message ?? ""),
    };
  }

  return { ok: true, id: data.id, number: data.invoice_number };
}
