import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingWizard from "@/components/OnboardingWizard";

export default async function WelcomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: settings } = await supabase
    .from("company_settings")
    .select("onboarded_at")
    .eq("user_id", user!.id)
    .maybeSingle();

  // Ya lo completo: no repetirlo
  if (settings?.onboarded_at) redirect("/dashboard");

  return (
    <div className="min-h-screen">
      <OnboardingWizard />
    </div>
  );
}
