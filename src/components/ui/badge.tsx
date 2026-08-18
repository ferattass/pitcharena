import { cn } from "@/lib/utils";

const variants = {
  /** Açık mavi zeminli, mockup'taki "LIVE INSIGHT" rozeti */
  live: "bg-electric-100 text-electric-700",
  neutral: "bg-navy-100 text-navy-600",
  outline: "border border-hairline bg-card text-navy-500",
  go: "bg-verdict-go/10 text-verdict-go",
  goif: "bg-verdict-goif/10 text-verdict-goif",
  nogo: "bg-verdict-nogo/10 text-verdict-nogo",
} as const;

export type BadgeVariant = keyof typeof variants;

export function Badge({
  variant = "neutral",
  className,
  ...props
}: React.ComponentProps<"span"> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        // NOT: CSS `uppercase` KULLANMA. lang="tr" altında tarayıcı Türkçe
        // büyük harf kuralını uygular ve "Insight" -> "İNSİGHT" olur.
        // Büyük harf isteniyorsa metni doğrudan büyük harfle yaz.
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

/** Yanıp sönen nokta + etiket — "Updating Now" göstergesi. */
export function LiveDot({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-navy-500">
      <span className="pulse-dot inline-block size-1.5 rounded-full bg-electric-500 text-electric-500" />
      {label}
    </span>
  );
}
