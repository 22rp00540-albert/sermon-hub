/** Hide raw Node/Prisma/engine messages from the UI when the API leaks them. */
export function userVisibleApiError(raw: unknown, fallback: string): string {
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  const lower = raw.toLowerCase();
  if (
    lower.includes("cannot read properties") ||
    lower.includes("cannot read property") ||
    /\breading\s+['"]/.test(lower) ||
    lower.includes("prisma") ||
    lower.includes("invocation in") ||
    lower.includes("invalid `") ||
    lower.includes("db.create") ||
    lower.includes("db.findmany") ||
    lower.includes("does not exist in the current database") ||
    lower.includes("unknown table")
  ) {
    return "Something went wrong. Please try again.";
  }
  return raw;
}
