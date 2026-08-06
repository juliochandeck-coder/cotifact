import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import QuoteForm from "@/components/QuoteForm";
import { Quote, CompanySettings, Client, Service } from "@/types";

export default async function EditQuotePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: quote }, { data: settings }, { data: clients }, { data: services }] =
    await Promise.all([
      supabase.from("quotes").select("*").eq("id", params.id).maybeSingle(),
      supabase.from("company_settings").select("*").eq("user_id", user!.id).maybeSingle(),
      supabase.from("clients").select("*").order("name"),
      supabase.from("services").select("*").order("name"),
    ]);

  if (!quote) notFound();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-ink mb-1">
          Editar {quote.quote_number}
        </h1>
        <p className="text-sm text-slate mb-6">
          Los cambios se reflejan en la cotización existente, conservando su número.
        </p>
        <QuoteForm
          mode="edit"
          quote={quote as Quote}
          settings={settings as CompanySettings | null}
          clients={(clients ?? []) as Client[]}
          services={(services ?? []) as Service[]}
        />
      </main>
    </div>
  );
}
