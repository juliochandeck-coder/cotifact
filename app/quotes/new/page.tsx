import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import QuoteForm from "@/components/QuoteForm";
import { CompanySettings, Client, Service } from "@/types";

export default async function NewQuotePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: settings }, { data: clients }, { data: services }] = await Promise.all([
    supabase.from("company_settings").select("*").eq("user_id", user!.id).maybeSingle(),
    supabase.from("clients").select("*").order("name"),
    supabase.from("services").select("*").order("name"),
  ]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="font-title text-2xl font-bold text-ink mb-1">Nueva cotización</h1>
        <p className="text-sm text-slate mb-6">Llena los campos y genera la cotización.</p>
        <QuoteForm
          mode="create"
          settings={settings as CompanySettings | null}
          clients={(clients ?? []) as Client[]}
          services={(services ?? []) as Service[]}
        />
      </main>
    </div>
  );
}
