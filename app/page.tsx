import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Debajo de esto, Resumen mostraria puros ceros: peor primera impresion que
// simplemente no ofrecerlo todavia. Cotizaciones es donde se trabaja mientras
// tanto, y es donde el asistente de bienvenida ya deja a las cuentas nuevas.
const MIN_ACCOUNT_AGE_DAYS = 14;
const MIN_DOCUMENTS_FOR_SUMMARY = 5;

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const ageMs = user.created_at ? Date.now() - new Date(user.created_at).getTime() : 0;
  const ageDays = ageMs / 86_400_000;

  const { count } = await supabase
    .from("quotes")
    .select("*", { count: "exact", head: true });

  const readyForSummary = ageDays >= MIN_ACCOUNT_AGE_DAYS && (count ?? 0) >= MIN_DOCUMENTS_FOR_SUMMARY;

  redirect(readyForSummary ? "/summary" : "/dashboard");
}
