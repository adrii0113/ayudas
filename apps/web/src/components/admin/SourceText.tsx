/** Source text with the rule excerpts highlighted, for side-by-side review. */
export function SourceText({ text, excerpts }: { text: string; excerpts: string[] }) {
  const ranges: [number, number][] = [];
  for (const excerpt of excerpts) {
    const at = text.indexOf(excerpt);
    if (at >= 0) ranges.push([at, at + excerpt.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start < cursor) continue;
    parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={start} className="rounded bg-yellow-200 px-0.5">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  parts.push(text.slice(cursor));
  return (
    <pre className="max-h-[75vh] overflow-auto whitespace-pre-wrap rounded-xl border border-gray-200 bg-white p-4 font-sans text-sm leading-relaxed">
      {parts}
    </pre>
  );
}
