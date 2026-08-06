import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils";

type Variant = "solid" | "subtle" | "outline" | "surface" | "plain";
type ColorPalette = "neutral" | "success" | "danger" | "warning" | "info";
type Size = "xs" | "sm" | "md" | "lg";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
  colorPalette?: ColorPalette;
  size?: Size;
};

const sizeClasses: Record<Size, string> = {
  xs: "px-1 py-0 text-xs",
  sm: "px-1.5 py-0 text-xs",
  md: "px-1.5 py-0.5 text-sm",
  lg: "px-2 py-1 text-base",
};

const styles: Record<Variant, Record<ColorPalette, string>> = {
  solid: {
    neutral: "bg-fg text-bg",
    success: "bg-success-solid text-success-solid-fg",
    danger: "bg-danger-solid text-danger-solid-fg",
    warning: "bg-warning-solid text-warning-solid-fg",
    info: "bg-info-solid text-info-solid-fg",
  },
  subtle: {
    neutral: "bg-surface-sunken text-fg-soft",
    success: "bg-success-subtle text-success-fg",
    danger: "bg-danger-subtle text-danger-fg",
    warning: "bg-warning-subtle text-warning-fg",
    info: "bg-info-subtle text-info-fg",
  },
  outline: {
    neutral: "border border-border text-fg-soft",
    success: "border border-success-border text-success-fg",
    danger: "border border-danger-border text-danger-fg",
    warning: "border border-warning-border text-warning-fg",
    info: "border border-info-border text-info-fg",
  },
  surface: {
    neutral: "bg-surface border border-border text-fg-soft",
    success: "bg-success-subtle border border-success-border text-success-fg",
    danger: "bg-danger-subtle border border-danger-border text-danger-fg",
    warning: "bg-warning-subtle border border-warning-border text-warning-fg",
    info: "bg-info-subtle border border-info-border text-info-fg",
  },
  plain: {
    neutral: "text-fg-soft",
    success: "text-success-fg",
    danger: "text-danger-fg",
    warning: "text-warning-fg",
    info: "text-info-fg",
  },
};

function Badge({
  variant = "subtle",
  colorPalette = "neutral",
  size = "md",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md font-medium",
        sizeClasses[size],
        styles[variant][colorPalette],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
