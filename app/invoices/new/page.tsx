import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import InvoiceForm from "@/components/InvoiceForm";
import { CompanySettings, Client } from "@/types";

export default async function NewInvoicePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: settings }, { data: clients }] = await Promise.all([
    supabase.from("company_settings").select("*").eq("user_id", user!.id).maybeSingle(),
    supabase.from("clients").select("*").order("name"),
  ]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="font-title text-2xl font-bold text-ink mb-1">Nueva factura</h1>
        <p className="text-sm text-slate mb-6">
          Para clientes que facturas directo, sin pasar por una cotización — comisión
          recurrente, por ejemplo.
        </p>
        <InvoiceForm
          mode="create"
          settings={settings as CompanySettings | null}
          clients={(clients ?? []) as Client[]}
        />
      </main>
    </div>
  );
}
