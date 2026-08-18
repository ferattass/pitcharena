import { cn } from "@/lib/utils";

type DivProps = React.ComponentProps<"div">;

export function Card({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-hairline bg-card shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: DivProps) {
  return <div className={cn("p-5 pb-0", className)} {...props} />;
}

export function CardBody({ className, ...props }: DivProps) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn("text-base font-semibold text-navy-900", className)}
      {...props}
    />
  );
}

/**
 * Mockup'taki küçük metrik kutusu: üstte etiket + ikon, ortada büyük değer,
 * altta isteğe bağlı görsel (bar, slider, delta).
 */
export function MetricTile({
  label,
  icon,
  children,
  className,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-hairline bg-card p-4 transition-shadow hover:shadow-lift",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs leading-tight font-medium text-navy-500">
          {label}
        </span>
        {icon ? <span className="text-electric-500">{icon}</span> : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
