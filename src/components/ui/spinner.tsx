import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type SpinnerProps = ComponentProps<typeof Loader2>;

function Spinner({ className, ...props }: SpinnerProps) {
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin text-fg-muted", className)}
      {...props}
    />
  );
}

export { Spinner };
