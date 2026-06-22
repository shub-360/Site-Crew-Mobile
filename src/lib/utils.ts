/**
 * Simple className joiner for NativeWind.
 * Filters out falsy values and joins with spaces.
 */
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(" ");
}
