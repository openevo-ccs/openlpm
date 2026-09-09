import { type ClassValue, clsx } from "clsx"

// No more tailwind-merge -- there are no Tailwind utility classes left to
// deconflict (see globals.css's header). clsx alone is still useful for
// conditionally joining plain class names.
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}
