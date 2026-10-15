import { AppShell } from "@/components/layout/app-shell";
import { requireOnboarded } from "@/lib/auth/session";
import { flags } from "@/lib/flags";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { profile } = await requireOnboarded();
  return (
    <AppShell
      displayName={profile.display_name}
      isAdmin={profile.role === "admin"}
      flags={{ referral: flags.referral() }}
    >
      {children}
    </AppShell>
  );
}
