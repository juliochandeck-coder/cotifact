import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import InvoiceDetailClient from "@/components/InvoiceDetailClient";
import { Invoice, CompanySettings } from "@/types";

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: invoice }, { data: company }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("company_settings").select("*").eq("user_id", user!.id).maybeSingle(),
  ]);

  if (!invoice) notFound();

  // Se trae el numero de la cotizacion asociada (si existe) para poder
  // avisarle al usuario exactamente cual queda libre si borra esta factura.
  let linkedQuoteNumber: string | null = null;
  if (invoice.quote_id) {
    const { data: quote } = await supabase
      .from("quotes")
      .select("quote_number")
      .eq("id", invoice.quote_id)
      .maybeSingle();
    linkedQuoteNumber = quote?.quote_number ?? null;
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <InvoiceDetailClient
          invoice={invoice as Invoice}
          company={company as CompanySettings | null}
          linkedQuoteNumber={linkedQuoteNumber}
        />
      </main>
    </div>
  );
}
