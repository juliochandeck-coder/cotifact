import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildEmail } from "@/lib/emailTemplate";
import { num } from "@/lib/format";
import { CompanySettings } from "@/types";

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    return NextResponse.json(
      {
        error:
          "Falta configurar el envío de correo. Agrega RESEND_API_KEY y RESEND_FROM en las variables de entorno.",
      },
      { status: 501 }
    );
  }

  let body: { kind?: string; id?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const kind = body.kind === "invoice" ? "invoice" : "quote";
  const id = body.id;
  if (!id) return NextResponse.json({ error: "Falta el documento." }, { status: 400 });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const table = kind === "invoice" ? "invoices" : "quotes";

  // RLS garantiza que solo se pueda leer un documento propio.
  const [{ data: doc }, { data: settings }] = await Promise.all([
    supabase.from(table).select("*").eq("id", id).maybeSingle(),
    supabase.from("company_settings").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  if (!doc) return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });

  const to = (doc.client_email ?? "").trim();
  if (!to) {
    return NextResponse.json(
      { error: "Este cliente no tiene correo. Agrégalo y vuelve a intentar." },
      { status: 422 }
    );
  }

  const company = settings as CompanySettings | null;

  const { subject, html, text } = buildEmail({
    kind,
    number: kind === "invoice" ? doc.invoice_number : doc.quote_number,
    clientName: doc.client_name,
    items: doc.items ?? [],
    subtotal: num(doc.subtotal),
    taxRate: num(doc.tax_rate),
    taxAmount: num(doc.tax_amount),
    total: num(doc.total),
    notes: doc.notes,
    dateLabel: kind === "invoice" ? "Vence" : "Válida hasta",
    dateValue: kind === "invoice" ? doc.due_date : doc.valid_until,
    company,
    message: body.message,
  });

  const replyTo = company?.company_email?.trim() || undefined;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json(
      { error: "El servicio de correo rechazó el envío.", detail: detail.slice(0, 300) },
      { status: 502 }
    );
  }

  // Marca enviado. En facturas tambien mueve el estado, salvo que ya este pagada.
  const patch: Record<string, unknown> = { sent_at: new Date().toISOString() };
  if (kind === "invoice" && doc.status === "pendiente") patch.status = "enviada";

  await supabase.from(table).update(patch).eq("id", id);

  return NextResponse.json({ ok: true, to });
}
