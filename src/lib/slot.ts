import {
  Children,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type SlotProps = {
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
};

export function Slot({ children, ...slotProps }: SlotProps) {
  if (!isValidElement<Record<string, unknown>>(children)) {
    return null;
  }
  const child = Children.only(children);
  return cloneElement(child, mergeProps(slotProps, child.props ?? {}));
}

function mergeProps(
  slot: Record<string, unknown>,
  child: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...slot };
  for (const [key, value] of Object.entries(child)) {
    if (key === "className") {
      merged.className = cn(slot.className as string, value as string);
    } else if (
      key.startsWith("on") &&
      typeof value === "function" &&
      typeof slot[key] === "function"
    ) {
      const slotHandler = slot[key] as (...args: unknown[]) => unknown;
      const childHandler = value as (...args: unknown[]) => unknown;
      merged[key] = (...args: unknown[]) => {
        slotHandler(...args);
        childHandler(...args);
      };
    } else if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged;
}
