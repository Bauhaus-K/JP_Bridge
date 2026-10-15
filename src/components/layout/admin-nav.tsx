"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type AdminNavItem = { href: string; label: string };

export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="운영자 메뉴" className="flex gap-1 overflow-x-auto">
      {items.map((item) => {
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active && "bg-accent font-medium text-accent-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
