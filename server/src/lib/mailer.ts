import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

/** Read env on each call so dotenv can load before first use (import order issue). */
const isMailEnvReady = () =>
  Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_PORT?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim() &&
      process.env.MAIL_FROM?.trim(),
  );

let transporter: Transporter | null = null;

const getTransporter = (): Transporter | null => {
  if (!isMailEnvReady()) {
    transporter = null;
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
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

export const isMailerConfigured = () => isMailEnvReady();

const OAA_DISPLAY_NAME = "Olivet Assembly Africa";

/** Base URL of the member web app (e.g. https://your-domain.com or http://localhost:5173). Used in notification links. */
const getMemberPortalOrigin = (): string => {
  const raw =
    process.env.MEMBER_PORTAL_URL?.trim() ||
    process.env.CLIENT_URL?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    "http://localhost:5173";
  return raw.replace(/\/+$/, "");
};

/** Link that opens the login screen, then sends the member to the library after sign-in. */
export const buildMemberPortalLoginLink = (): string => {
  const base = getMemberPortalOrigin();
  const next = encodeURIComponent("/member");
  // `from=email` matches client LoginPage so email links are not redirected to `/`.
  return `${base}/login?from=email&next=${next}`;
};

const extractSmtpAddress = (mailFrom: string): string => {
  const m = mailFrom.match(/<([^>]+)>/);
  return (m ? m[1] : mailFrom).trim();
};

/** From header: display name Olivet Assembly Africa, envelope address from MAIL_FROM. */
const senderOlivetAssemblyAfrica = (): string => {
  const raw = process.env.MAIL_FROM?.trim() || "";
  if (!raw) return "";
  const addr = extractSmtpAddress(raw);
  return `${OAA_DISPLAY_NAME} <${addr}>`;
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export type MemberLibraryUploadKind = "audio" | "video" | "documents";

const kindLabel = (kind: MemberLibraryUploadKind): string => {
  if (kind === "audio") return "New audio sermon";
  if (kind === "video") return "New video sermon";
  return "New sermon documents";
};

/**
 * Notify all approved members: new library content + link to open the portal (login → member area).
 * Recipients are BCC so addresses stay private.
 */
export const sendApprovedMembersLibraryUploadEmail = async (
  emails: string[],
  kind: MemberLibraryUploadKind,
  title: string,
) => {
  const tx = getTransporter();
  if (!tx || emails.length === 0) {
    return;
  }

  const from = senderOlivetAssemblyAfrica() || process.env.MAIL_FROM;
  const link = buildMemberPortalLoginLink();
  const summary = kindLabel(kind);
  const subject = `${OAA_DISPLAY_NAME}: ${summary} — ${title}`;
  const text = `${summary}: "${title}".\n\nOpen the member portal (sign in if asked):\n${link}\n\n— ${OAA_DISPLAY_NAME}`;
  const html = `<p><strong>${escapeHtml(OAA_DISPLAY_NAME)}</strong></p>
<p>${escapeHtml(summary)}: <strong>${escapeHtml(title)}</strong></p>
<p><a href="${escapeHtml(link)}">Open the member portal</a></p>
<p style="color:#64748b;font-size:13px;">If the button does not work, copy this link into your browser:<br>${escapeHtml(
    link,
  )}</p>`;

  await tx.sendMail({
    from,
    bcc: emails,
    subject,
    text,
    html,
  });
};

/** @deprecated Use sendApprovedMembersLibraryUploadEmail with a kind. */
export const sendNewSermonNotification = async (emails: string[], title: string) => {
  await sendApprovedMembersLibraryUploadEmail(emails, "audio", title);
};

export const sendPasswordResetCode = async (email: string, code: string) => {
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
