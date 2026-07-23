import { customAlphabet } from "nanoid";

const suffix = customAlphabet("abcdefghjkmnpqrstuvwxyz23456789", 6);

export function makeSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "event"}-${suffix()}`;
}
