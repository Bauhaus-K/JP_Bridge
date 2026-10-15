import { Brand } from "@/components/layout/brand";

export default function SetupLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <Brand href="/dashboard" />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-2xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
