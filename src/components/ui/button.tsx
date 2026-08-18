import Link from "next/link";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-electric-500 text-white shadow-card hover:bg-electric-600 disabled:bg-navy-200",
  secondary: "border border-hairline bg-card text-navy-700 hover:bg-navy-50 disabled:text-navy-300",
  ghost: "text-navy-500 hover:bg-navy-50 hover:text-navy-900",
} as const;

const sizes = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-[13px]",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-6 text-[15px]",
} as const;

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

const base =
  "inline-flex items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
