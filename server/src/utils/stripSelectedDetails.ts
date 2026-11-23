export function stripSelectedDetails(value: unknown): string {
  const raw = String(value ?? "");
  if (!raw) return "";
  return raw
    .replace(/\r?\n?\s*Selected\s+details\s*:[^\r\n]*/gi, "")
    .replace(/\s*\|\s*Selected\s+details\s*:[^|]*/gi, "")
    .trim();
}
