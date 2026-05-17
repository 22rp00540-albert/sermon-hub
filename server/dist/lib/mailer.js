"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordResetCode = exports.sendNewSermonNotification = exports.sendApprovedMembersLibraryUploadEmail = exports.buildMemberPortalLoginLink = exports.isMailerConfigured = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
/** Read env on each call so dotenv can load before first use (import order issue). */
const isMailEnvReady = () => Boolean(process.env.SMTP_HOST?.trim() &&
    process.env.SMTP_PORT?.trim() &&
    process.env.SMTP_USER?.trim() &&
    process.env.SMTP_PASS?.trim() &&
    process.env.MAIL_FROM?.trim());
let transporter = null;
const getTransporter = () => {
    if (!isMailEnvReady()) {
        transporter = null;
        return null;
    }
    if (!transporter) {
        transporter = nodemailer_1.default.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }
    return transporter;
};
const isMailerConfigured = () => isMailEnvReady();
exports.isMailerConfigured = isMailerConfigured;
const OAA_DISPLAY_NAME = "Olivet Assembly Africa";
/** Base URL of the member web app (e.g. https://your-domain.com or http://localhost:5173). Used in notification links. */
const getMemberPortalOrigin = () => {
    const raw = process.env.MEMBER_PORTAL_URL?.trim() ||
        process.env.CLIENT_URL?.trim() ||
        process.env.FRONTEND_URL?.trim() ||
        "http://localhost:5173";
    return raw.replace(/\/+$/, "");
};
/** Link that opens the login screen, then sends the member to the library after sign-in. */
const buildMemberPortalLoginLink = () => {
    const base = getMemberPortalOrigin();
    const next = encodeURIComponent("/member");
    // `from=email` matches client LoginPage so email links are not redirected to `/`.
    return `${base}/login?from=email&next=${next}`;
};
exports.buildMemberPortalLoginLink = buildMemberPortalLoginLink;
const extractSmtpAddress = (mailFrom) => {
    const m = mailFrom.match(/<([^>]+)>/);
    return (m ? m[1] : mailFrom).trim();
};
/** From header: display name Olivet Assembly Africa, envelope address from MAIL_FROM. */
const senderOlivetAssemblyAfrica = () => {
    const raw = process.env.MAIL_FROM?.trim() || "";
    if (!raw)
        return "";
    const addr = extractSmtpAddress(raw);
    return `${OAA_DISPLAY_NAME} <${addr}>`;
};
const escapeHtml = (s) => s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const kindLabel = (kind) => {
    if (kind === "audio")
        return "New audio sermon";
    if (kind === "video")
        return "New video sermon";
    return "New sermon documents";
};
/**
 * Notify all approved members: new library content + link to open the portal (login → member area).
 * Recipients are BCC so addresses stay private.
 */
const sendApprovedMembersLibraryUploadEmail = async (emails, kind, title) => {
    const tx = getTransporter();
    if (!tx || emails.length === 0) {
        return;
    }
    const from = senderOlivetAssemblyAfrica() || process.env.MAIL_FROM;
    const link = (0, exports.buildMemberPortalLoginLink)();
    const summary = kindLabel(kind);
    const subject = `${OAA_DISPLAY_NAME}: ${summary} — ${title}`;
    const text = `${summary}: "${title}".\n\nOpen the member portal (sign in if asked):\n${link}\n\n— ${OAA_DISPLAY_NAME}`;
    const html = `<p><strong>${escapeHtml(OAA_DISPLAY_NAME)}</strong></p>
<p>${escapeHtml(summary)}: <strong>${escapeHtml(title)}</strong></p>
<p><a href="${escapeHtml(link)}">Open the member portal</a></p>
<p style="color:#64748b;font-size:13px;">If the button does not work, copy this link into your browser:<br>${escapeHtml(link)}</p>`;
    await tx.sendMail({
        from,
        bcc: emails,
        subject,
        text,
        html,
    });
};
exports.sendApprovedMembersLibraryUploadEmail = sendApprovedMembersLibraryUploadEmail;
/** @deprecated Use sendApprovedMembersLibraryUploadEmail with a kind. */
const sendNewSermonNotification = async (emails, title) => {
    await (0, exports.sendApprovedMembersLibraryUploadEmail)(emails, "audio", title);
};
exports.sendNewSermonNotification = sendNewSermonNotification;
const sendPasswordResetCode = async (email, code) => {
    const tx = getTransporter();
    if (!tx) {
        throw new Error("Email service is not configured. Set SMTP_* and MAIL_FROM in server/.env.");
    }
    await tx.sendMail({
        from: process.env.MAIL_FROM,
        to: email,
        subject: "Password Reset Code",
        text: `Your password reset code is: ${code}. This code expires in 10 minutes.`,
    });
};
exports.sendPasswordResetCode = sendPasswordResetCode;
