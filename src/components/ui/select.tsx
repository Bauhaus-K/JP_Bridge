import * as React from "react";

import { cn } from "@/lib/utils";
import { controlClass } from "./input";

/** 접근성과 모바일 UX를 위해 네이티브 select 를 스타일링해 사용한다. */
export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(controlClass, "h-10 py-2 pr-8", className)} {...props} />;
}
