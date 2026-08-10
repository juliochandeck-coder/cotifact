import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import QuoteDetailClient from "@/components/QuoteDetailClient";
import { Quote, Invoice, CompanySettings } from "@/types";

export default async function QuoteDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: quote }, { data: company }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("company_settings").select("*").eq("user_id", user!.id).maybeSingle(),
  ]);

  if (!quote) notFound();
  const q = quote as Quote;

  // Un retainer puede tener varias facturas ligadas a la misma cotizacion
  // (una por mes) — no cabe en una sola fila. Las normales siguen con una
  // sola, como antes.
  const [{ data: invoices }, { data: siblings }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .eq("quote_id", params.id)
      .order("created_at", { ascending: false }),
    q.is_retainer && q.retainer_group_id
      ? supabase
          .from("quotes")
          .select("id, quote_number, total, status, created_at")
          .eq("retainer_group_id", q.retainer_group_id)
          .neq("id", params.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <QuoteDetailClient
          quote={q}
          invoices={(invoices ?? []) as Invoice[]}
          retainerSiblings={
            (siblings ?? []) as { id: string; quote_number: string; total: number; status: string; created_at: string }[]
          }
          company={company as CompanySettings | null}
        />
      </main>
    </div>
  );
}
