"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { FEATURES } from "@/lib/features";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="주요 메뉴" className="grid gap-1">
      {FEATURES.map((f) => {
        const Icon = f.icon;
        const active = isActive(pathname, f.href);
        if (!f.available) {
          return (
            <span
              key={f.key}
              aria-disabled="true"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/70"
            >
              <Icon aria-hidden="true" className="size-4" />
              {f.label}
              <Badge variant="outline" className="ml-auto">
                준비 중
              </Badge>
            </span>
          );
        }
        return (
          <Link
            key={f.key}
            href={f.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active && "bg-accent text-accent-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {f.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomTabs() {
  const pathname = usePathname();
  const tabs = FEATURES.filter((f) => f.mobileTab);
  return (
    <nav
      aria-label="하단 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul
        className="grid"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((f) => {
          const Icon = f.icon;
          const active = isActive(pathname, f.href);
          const content = (
            <>
              <Icon aria-hidden="true" className="size-5" />
              <span>{f.shortLabel}</span>
            </>
          );
          const base = "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px]";
          return (
            <li key={f.key}>
              {f.available ? (
                <Link
                  href={f.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    base,
                    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50",
                    active ? "font-semibold text-primary" : "text-muted-foreground",
                  )}
                >
                  {content}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  title="준비 중"
                  className={cn(base, "text-muted-foreground/50")}
                >
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
