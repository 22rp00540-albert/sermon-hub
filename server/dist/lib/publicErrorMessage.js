"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicServerErrorMessage = void 0;
/** Avoid leaking raw Node/Prisma/engine details to API clients. */
const publicServerErrorMessage = (raw) => {
    const lower = raw.toLowerCase();
    if (lower.includes("cannot read properties") ||
        lower.includes("cannot read property") ||
        /\breading\s+['"]/.test(lower) ||
        lower.includes("prisma") ||
        lower.includes("invocation in") ||
        lower.includes("invalid `") ||
        lower.includes("db.create") ||
        lower.includes("db.findmany") ||
        lower.includes("db.update") ||
        lower.includes("db.delete") ||
        lower.includes("does not exist in the current database") ||
        lower.includes("unknown table")) {
        return "Something went wrong. Please try again later.";
    }
    return raw;
};
exports.publicServerErrorMessage = publicServerErrorMessage;
