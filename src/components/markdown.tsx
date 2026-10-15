import { parseMarkdown, type Inline } from "@/lib/content/markdown";

function Inlines({ inlines }: { inlines: Inline[] }) {
  return inlines.map((i, idx) => (i.bold ? <strong key={idx}>{i.text}</strong> : i.text));
}

export function Markdown({ source }: { source: string }) {
  const blocks = parseMarkdown(source);
  return (
    <div className="grid gap-4 leading-7">
      {blocks.map((b, idx) => {
        switch (b.type) {
          case "heading":
            if (b.level === 1)
              return (
                <h1 key={idx} className="text-2xl font-semibold">
                  <Inlines inlines={b.inlines} />
                </h1>
              );
            if (b.level === 2)
              return (
                <h2 key={idx} className="mt-4 text-lg font-semibold">
                  <Inlines inlines={b.inlines} />
                </h2>
              );
            return (
              <h3 key={idx} className="mt-2 font-semibold">
                <Inlines inlines={b.inlines} />
              </h3>
            );
          case "list":
            return (
              <ul key={idx} className="list-disc space-y-1 pl-5">
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Inlines inlines={item} />
                  </li>
                ))}
              </ul>
            );
          case "quote":
            return (
              <blockquote key={idx} className="border-l-4 pl-4 text-muted-foreground">
                <Inlines inlines={b.inlines} />
              </blockquote>
            );
          default:
            return (
              <p key={idx}>
                <Inlines inlines={b.inlines} />
              </p>
            );
        }
      })}
    </div>
  );
}
