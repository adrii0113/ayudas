export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="prose max-w-2xl space-y-4 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-6 [&_li]:list-disc">
      <h1 className="display text-[clamp(2.25rem,6vw,3.5rem)]">{title}</h1>
      {children}
    </article>
  );
}
