import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Slot } from "@/lib/slot";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "solid"
  | "subtle"
  | "outline"
  | "ghost"
  | "surface"
  | "plain";
export type ButtonColorPalette =
  | "neutral"
  | "success"
  | "danger"
  | "warning"
  | "info";
type Variant = ButtonVariant;
type ColorPalette = ButtonColorPalette;
type Size = "xs" | "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  colorPalette?: ColorPalette;
  size?: Size;
  loading?: boolean;
  loadingText?: string;
  asChild?: boolean;
};

const sizeClasses: Record<Size, string> = {
  xs: "h-7 gap-1.5 px-2 text-xs",
  sm: "h-8 gap-2 px-3 text-sm",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-6 text-base",
};

export const buttonStyles: Record<Variant, Record<ColorPalette, string>> = {
  solid: {
    neutral: "bg-fg text-bg hover:bg-fg-soft",
    success: "bg-success-solid text-success-solid-fg hover:bg-success-solid/90",
    danger: "bg-danger-solid text-danger-solid-fg hover:bg-danger-solid/90",
    warning: "bg-warning-solid text-warning-solid-fg hover:bg-warning-solid/90",
    info: "bg-info-solid text-info-solid-fg hover:bg-info-solid/90",
  },
  subtle: {
    neutral: "bg-surface-sunken text-fg hover:bg-surface-sunken-hover",
    success: "bg-success-subtle text-success-fg hover:bg-success-border",
    danger: "bg-danger-subtle text-danger-fg hover:bg-danger-border",
    warning: "bg-warning-subtle text-warning-fg hover:bg-warning-border",
    info: "bg-info-subtle text-info-fg hover:bg-info-border",
  },
  outline: {
    neutral: "border border-border bg-surface text-fg hover:bg-hover",
    success:
      "border border-success-border text-success-fg hover:bg-success-subtle",
    danger:
      "border border-danger-border text-danger-fg hover:bg-danger-subtle",
    warning:
      "border border-warning-border text-warning-fg hover:bg-warning-subtle",
    info: "border border-info-border text-info-fg hover:bg-info-subtle",
  },
  ghost: {
    neutral: "text-fg hover:bg-hover",
    success: "text-success-fg hover:bg-success-subtle",
    danger: "text-danger-fg hover:bg-danger-subtle",
    warning: "text-warning-fg hover:bg-warning-subtle",
    info: "text-info-fg hover:bg-info-subtle",
  },
  surface: {
    neutral:
      "border border-border bg-surface-sunken text-fg hover:bg-surface-sunken-hover",
    success:
      "border border-success-border bg-success-subtle text-success-fg hover:bg-success-border",
    danger:
      "border border-danger-border bg-danger-subtle text-danger-fg hover:bg-danger-border",
    warning:
      "border border-warning-border bg-warning-subtle text-warning-fg hover:bg-warning-border",
    info: "border border-info-border bg-info-subtle text-info-fg hover:bg-info-border",
  },
  plain: {
    neutral: "text-fg hover:underline underline-offset-4",
    success: "text-success-fg hover:underline underline-offset-4",
    danger: "text-danger-fg hover:underline underline-offset-4",
    warning: "text-warning-fg hover:underline underline-offset-4",
    info: "text-info-fg hover:underline underline-offset-4",
  },
};

function Button({
  variant = "solid",
  colorPalette = "neutral",
  size = "md",
  loading = false,
  loadingText,
  asChild = false,
  disabled,
  className,
  type,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  const isDisabled = disabled || loading;
  return (
    <Comp
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        sizeClasses[size],
        buttonStyles[variant][colorPalette],
        className,
      )}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      disabled={isDisabled}
      {...(asChild ? {} : { type: type ?? "button" })}
      {...props}
    >
      {loading ? (
        <>
          <Spinner className="size-4" />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button };
