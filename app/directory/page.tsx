import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import DirectoryClient from "@/components/DirectoryClient";
import { Client, Service, CompanySettings } from "@/types";

export default async function DirectoryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: clients }, { data: services }, { data: settings }] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("services").select("*").order("name"),
    supabase.from("company_settings").select("*").eq("user_id", user!.id).maybeSingle(),
  ]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-ink">Directorio</h1>
        <p className="text-sm text-slate mt-1 mb-6">
          Tus clientes y servicios guardados. Se autocompletan al cotizar.
        </p>
        <DirectoryClient
          initialClients={(clients ?? []) as Client[]}
          initialServices={(services ?? []) as Service[]}
          company={settings as CompanySettings | null}
        />
      </main>
    </div>
  );
}
