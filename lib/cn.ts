import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class strings safely. Later classes override earlier ones
 * even when they belong to the same Tailwind utility group.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
