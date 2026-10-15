import { cn } from "@/lib/utils";

/** Full-bleed band with an eyebrow and a large display heading. */
export function SectionBand({
  eyebrow,
  title,
  id,
  as: Heading = "h2",
  className,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  id?: string;
  as?: "h1" | "h2";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("bleed bleed-band space-y-4 py-10 sm:py-12", className)}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <Heading
        id={id}
        className={cn(
          "display",
          Heading === "h1"
            ? "text-[clamp(2.5rem,7vw,4.5rem)]"
            : "text-[clamp(2.125rem,5.5vw,3.75rem)]",
        )}
      >
        {title}
      </Heading>
      {children}
    </div>
  );
}
