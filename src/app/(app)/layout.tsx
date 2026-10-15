import { AppShell } from "@/components/layout/app-shell";
import { requireOnboarded } from "@/lib/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { profile } = await requireOnboarded();
  return (
    <AppShell displayName={profile.display_name} isAdmin={profile.role === "admin"}>
      {children}
    </AppShell>
  );
}
