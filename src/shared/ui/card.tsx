import type { HTMLAttributes } from "react";
import { Slot } from "@/shared/lib/slot";
import { cn } from "@/shared/lib/utils";

type DivProps = HTMLAttributes<HTMLDivElement>;

type CardSize = "sm" | "md" | "lg";
type CardVariant = "elevated" | "outline" | "subtle";

const variantClasses: Record<CardVariant, string> = {
  elevated:
    "bg-surface border border-border-muted shadow-[0_1px_0_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06),0_0_4px_rgba(0,0,0,0.03)]",
  outline: "bg-surface border border-border",
  subtle: "bg-surface-muted",
};

type RootProps = DivProps & {
  variant?: CardVariant;
  size?: CardSize;
  asChild?: boolean;
};

function Root({
  variant = "outline",
  size = "md",
  asChild = false,
  className,
  ...props
}: RootProps) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      data-size={size}
      className={cn(
        "group/card rounded-lg",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

function Header({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        "group-data-[size=sm]/card:px-4 group-data-[size=sm]/card:pt-6 group-data-[size=sm]/card:pb-1 group-data-[size=sm]/card:last:pb-6",
        "group-data-[size=md]/card:px-6 group-data-[size=md]/card:pt-6 group-data-[size=md]/card:pb-2 group-data-[size=md]/card:last:pb-6",
        "group-data-[size=lg]/card:px-8 group-data-[size=lg]/card:pt-8 group-data-[size=lg]/card:pb-2 group-data-[size=lg]/card:last:pb-8",
        className,
      )}
      {...props}
    />
  );
}

function Title({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-lg font-semibold text-fg-soft", className)}
      {...props}
    />
  );
}

function Description({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm leading-normal text-fg-muted", className)}
      {...props}
    />
  );
}

function Body({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "group-data-[size=sm]/card:px-4 group-data-[size=sm]/card:pt-2 group-data-[size=sm]/card:pb-4",
        "group-data-[size=md]/card:px-6 group-data-[size=md]/card:pt-4 group-data-[size=md]/card:pb-6",
        "group-data-[size=lg]/card:px-8 group-data-[size=lg]/card:pt-4 group-data-[size=lg]/card:pb-8",
        className,
      )}
      {...props}
    />
  );
}

function Footer({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2",
        "group-data-[size=sm]/card:px-4 group-data-[size=sm]/card:pt-2 group-data-[size=sm]/card:pb-4",
        "group-data-[size=md]/card:px-6 group-data-[size=md]/card:pt-2 group-data-[size=md]/card:pb-6",
        "group-data-[size=lg]/card:px-8 group-data-[size=lg]/card:pt-2 group-data-[size=lg]/card:pb-8",
        className,
      )}
      {...props}
    />
  );
}

export const Card = {
  Root,
  Header,
  Title,
  Description,
  Body,
  Footer,
};
