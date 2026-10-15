import Link from "next/link";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span
        aria-hidden="true"
        className="grid size-7 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
      >
        JB
      </span>
      <span>JP Bridge</span>
    </Link>
  );
}
