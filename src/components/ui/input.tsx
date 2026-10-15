import * as React from "react";

import { cn } from "@/lib/utils";

export const controlClass =
  "flex w-full min-w-0 rounded-md border border-input bg-card px-3 text-base shadow-xs transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(controlClass, "h-10 py-2", className)} {...props} />;
}
