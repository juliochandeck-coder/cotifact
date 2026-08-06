import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import SettingsClient from "@/components/SettingsClient";
import { CompanySettings } from "@/types";

export default async function SettingsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: company } = await supabase
    .from("company_settings")
    .select("*")
    .eq("user_id", user!.id)
    .maybeSingle();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-ink mb-1">Marca y datos de la empresa</h1>
        <p className="text-sm text-slate mb-6">
          Esto aparece en el encabezado de tus cotizaciones y facturas.
        </p>
        <SettingsClient initial={company as CompanySettings | null} />
      </main>
    </div>
  );
}
