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

  // Las tres consultas se disparan a la vez en lugar de una tras otra.
  const [{ data: quote }, { data: invoice }, { data: company }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("invoices").select("*").eq("quote_id", params.id).maybeSingle(),
    supabase.from("company_settings").select("*").eq("user_id", user!.id).maybeSingle(),
  ]);

  if (!quote) notFound();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <QuoteDetailClient
          quote={quote as Quote}
          existingInvoice={invoice as Invoice | null}
          company={company as CompanySettings | null}
        />
      </main>
    </div>
  );
}
