"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPasswordWithCode = exports.requestPasswordReset = exports.login = exports.registerMember = void 0;
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const mailer_1 = require("../lib/mailer");
const prisma_1 = require("../lib/prisma");
const registerSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2),
    email: zod_1.z.email(),
    password: zod_1.z.string().min(6),
    country: zod_1.z.string().min(2),
    phoneNumber: zod_1.z.string().min(5),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.email(),
    password: zod_1.z.string().min(6),
});
const forgotPasswordRequestSchema = zod_1.z.object({
    email: zod_1.z.email(),
});
const forgotPasswordResetSchema = zod_1.z
    .object({
    email: zod_1.z.email(),
    code: zod_1.z.string().trim().length(6),
    newPassword: zod_1.z.string().min(6),
    confirmPassword: zod_1.z.string().min(6),
})
    .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});
const registerMember = async (input) => {
    const data = registerSchema.parse(input);
    const existing = await prisma_1.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
        throw new Error("Email already in use");
    }
    const passwordHash = await bcrypt_1.default.hash(data.password, 10);
    const user = await prisma_1.prisma.user.create({
        data: {
            fullName: data.fullName,
            email: data.email,
            passwordHash,
            country: data.country,
            phoneNumber: data.phoneNumber,
            role: client_1.Role.MEMBER,
            status: client_1.UserStatus.PENDING,
        },
    });
    return {
        id: user.id,
        email: user.email,
        status: user.status,
        message: "Registration successful. Waiting for admin approval.",
    };
};
exports.registerMember = registerMember;
const login = async (input) => {
    const data = loginSchema.parse(input);
    const user = await prisma_1.prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
        throw new Error("Invalid email or password");
    }
    const validPassword = await bcrypt_1.default.compare(data.password, user.passwordHash);
    if (!validPassword) {
        throw new Error("Invalid email or password");
    }
    if (user.role === client_1.Role.MEMBER && user.status !== client_1.UserStatus.APPROVED) {
        throw new Error("Your account is waiting for admin approval");
    }
    const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });
    return {
        token,
        user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            status: user.status,
        },
    };
};
exports.login = login;
const generateResetCode = () => `${Math.floor(100000 + Math.random() * 900000)}`;
const PASSWORD_RESET_COOLDOWN_SECONDS = 60;
const PASSWORD_RESET_MAX_PER_HOUR = 3;
const requestPasswordReset = async (input) => {
    const data = forgotPasswordRequestSchema.parse(input);
    if (!(0, mailer_1.isMailerConfigured)()) {
        throw new Error("Email service is not configured yet. Please contact admin.");
    }
    const user = await prisma_1.prisma.user.findUnique({ where: { email: data.email } });
    // Always return a generic success message to avoid email enumeration.
    if (!user) {
        return { message: "If the email exists, a reset code has been sent." };
    }
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneMinuteAgo = new Date(now.getTime() - PASSWORD_RESET_COOLDOWN_SECONDS * 1000);
    const [recentRequestCount, latestRequest] = await Promise.all([
        prisma_1.prisma.passwordResetCode.count({
            where: {
                userId: user.id,
                createdAt: { gt: oneHourAgo },
            },
        }),
        prisma_1.prisma.passwordResetCode.findFirst({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
        }),
    ]);
    if (recentRequestCount >= PASSWORD_RESET_MAX_PER_HOUR) {
        throw new Error("Too many reset requests. Please try again in about one hour.");
    }
    if (latestRequest && latestRequest.createdAt > oneMinuteAgo) {
        throw new Error("Please wait 60 seconds before requesting another reset code.");
    }
    const code = generateResetCode();
    const codeHash = await bcrypt_1.default.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await prisma_1.prisma.passwordResetCode.updateMany({
        where: { userId: user.id, consumedAt: null },
        data: { consumedAt: new Date() },
    });
    await prisma_1.prisma.passwordResetCode.create({
        data: {
            userId: user.id,
            codeHash,
            expiresAt,
        },
    });
    await (0, mailer_1.sendPasswordResetCode)(user.email, code);
    return { message: "If the email exists, a reset code has been sent." };
};
exports.requestPasswordReset = requestPasswordReset;
const resetPasswordWithCode = async (input) => {
    const parsed = forgotPasswordResetSchema.safeParse(input);
    if (!parsed.success) {
        const issues = parsed.error.issues;
        if (issues.some((i) => String(i.message).toLowerCase().includes("match"))) {
            throw new Error("Passwords do not match.");
        }
        if (issues.some((i) => (i.path[0] === "newPassword" || i.path[0] === "confirmPassword") &&
            i.code === "too_small")) {
            throw new Error("New password and confirmation must each be at least 6 characters.");
        }
        throw new Error(issues[0]?.message ?? "Invalid password reset data.");
    }
    const data = parsed.data;
    const user = await prisma_1.prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
        throw new Error("Invalid reset code or email");
    }
    const resetRow = await prisma_1.prisma.passwordResetCode.findFirst({
        where: {
            userId: user.id,
            consumedAt: null,
            expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
    });
    if (!resetRow) {
        throw new Error("Reset code expired or invalid");
    }
    const codeMatches = await bcrypt_1.default.compare(data.code, resetRow.codeHash);
    if (!codeMatches) {
        throw new Error("Invalid reset code or email");
    }
    const passwordHash = await bcrypt_1.default.hash(data.newPassword, 10);
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash },
        }),
        prisma_1.prisma.passwordResetCode.update({
            where: { id: resetRow.id },
            data: { consumedAt: new Date() },
        }),
        prisma_1.prisma.passwordResetCode.updateMany({
            where: { userId: user.id, consumedAt: null },
            data: { consumedAt: new Date() },
        }),
    ]);
    return { message: "Password reset successful. You can now log in." };
};
exports.resetPasswordWithCode = resetPasswordWithCode;
