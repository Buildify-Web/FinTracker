import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// shadcn's class-name helper: join conditionally, and let later Tailwind classes win.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
