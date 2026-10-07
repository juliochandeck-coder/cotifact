import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import DesignEditor from "@/components/DesignEditor";
import { CompanySettings, Quote, Invoice } from "@/types";

export default async function DesignPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // La vista previa usa tu última cotización y factura reales (si existen).
  const [{ data: company }, { data: quote }, { data: invoice }] = await Promise.all([
    supabase.from("company_settings").select("*").eq("user_id", user!.id).maybeSingle(),
    supabase.from("quotes").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="font-title text-2xl font-bold text-ink mb-1">Diseño de documentos</h1>
        <p className="text-sm text-slate mb-6">
          Cambia colores, tipografía, tamaños, tabla y textos de tus cotizaciones y facturas. La vista
          previa se actualiza al instante; los cambios se aplican a todos tus documentos al guardar.
        </p>
        <DesignEditor
          company={company as CompanySettings | null}
          sampleQuote={(quote as Quote) ?? null}
          sampleInvoice={(invoice as Invoice) ?? null}
        />
      </main>
    </div>
  );
}
