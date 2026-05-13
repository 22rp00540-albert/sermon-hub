"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordResetCode = exports.sendNewSermonNotification = exports.isMailerConfigured = void 0;
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
const sendNewSermonNotification = async (emails, title) => {
    const tx = getTransporter();
    if (!tx || emails.length === 0) {
        return;
    }
    await tx.sendMail({
        from: process.env.MAIL_FROM,
        to: emails,
        subject: `New Sermon Uploaded: ${title}`,
        text: `A new sermon titled "${title}" has been uploaded. Please login to listen.`,
    });
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
