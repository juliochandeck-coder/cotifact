import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import InvoiceForm from "@/components/InvoiceForm";
import { Invoice, CompanySettings } from "@/types";

export default async function EditInvoicePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: invoice }, { data: settings }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("company_settings").select("*").eq("user_id", user!.id).maybeSingle(),
  ]);

  if (!invoice) notFound();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="font-title text-2xl font-bold text-ink mb-1">
          Editar {invoice.invoice_number}
        </h1>
        <p className="text-sm text-slate mb-6">
          Los cambios se reflejan en la factura existente.
        </p>
        <InvoiceForm invoice={invoice as Invoice} settings={settings as CompanySettings | null} />
      </main>
    </div>
  );
}
