import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely trigger device haptic feedback if supported.
 * @param pattern - Duration in ms or an array of durations (e.g., [50, 100, 50])
 */
export function vibrate(pattern: number | number[] = 50) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Ignore errors for devices/browsers that do not support or restrict vibrate
    }
  }
}
