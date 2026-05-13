import { Role, UserStatus } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { isMailerConfigured, sendPasswordResetCode } from "../lib/mailer";
import { prisma } from "../lib/prisma";

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.email(),
  password: z.string().min(6),
  country: z.string().min(2),
  phoneNumber: z.string().min(5),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

const forgotPasswordRequestSchema = z.object({
  email: z.email(),
});

const forgotPasswordResetSchema = z
  .object({
    email: z.email(),
    code: z.string().trim().length(6),
    newPassword: z.string().min(6),
    confirmPassword: z.string().min(6),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const registerMember = async (input: unknown) => {
  const data = registerSchema.parse(input);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new Error("Email already in use");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      fullName: data.fullName,
      email: data.email,
      passwordHash,
      country: data.country,
      phoneNumber: data.phoneNumber,
      role: Role.MEMBER,
      status: UserStatus.PENDING,
    },
  });

  return {
    id: user.id,
    email: user.email,
    status: user.status,
    message: "Registration successful. Waiting for admin approval.",
  };
};

export const login = async (input: unknown) => {
  const data = loginSchema.parse(input);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    throw new Error("Invalid email or password");
  }

  const validPassword = await bcrypt.compare(data.password, user.passwordHash);
  if (!validPassword) {
    throw new Error("Invalid email or password");
  }

  if (user.role === Role.MEMBER && user.status !== UserStatus.APPROVED) {
    throw new Error("Your account is waiting for admin approval");
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET as string,
    { expiresIn: "1d" },
  );

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

const generateResetCode = () => `${Math.floor(100000 + Math.random() * 900000)}`;

const PASSWORD_RESET_COOLDOWN_SECONDS = 60;
const PASSWORD_RESET_MAX_PER_HOUR = 3;

export const requestPasswordReset = async (input: unknown) => {
  const data = forgotPasswordRequestSchema.parse(input);

  if (!isMailerConfigured()) {
    throw new Error("Email service is not configured yet. Please contact admin.");
  }

  const user = await prisma.user.findUnique({ where: { email: data.email } });

  // Always return a generic success message to avoid email enumeration.
  if (!user) {
    return { message: "If the email exists, a reset code has been sent." };
  }

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneMinuteAgo = new Date(now.getTime() - PASSWORD_RESET_COOLDOWN_SECONDS * 1000);

  const [recentRequestCount, latestRequest] = await Promise.all([
    prisma.passwordResetCode.count({
      where: {
        userId: user.id,
        createdAt: { gt: oneHourAgo },
      },
    }),
    prisma.passwordResetCode.findFirst({
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
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.passwordResetCode.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.passwordResetCode.create({
    data: {
      userId: user.id,
      codeHash,
      expiresAt,
    },
  });

  await sendPasswordResetCode(user.email, code);
  return { message: "If the email exists, a reset code has been sent." };
};

export const resetPasswordWithCode = async (input: unknown) => {
  const parsed = forgotPasswordResetSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues;
    if (issues.some((i) => String(i.message).toLowerCase().includes("match"))) {
      throw new Error("Passwords do not match.");
    }
    if (
      issues.some(
        (i) =>
          (i.path[0] === "newPassword" || i.path[0] === "confirmPassword") &&
          i.code === "too_small",
      )
    ) {
      throw new Error("New password and confirmation must each be at least 6 characters.");
    }
    throw new Error(issues[0]?.message ?? "Invalid password reset data.");
  }
  const data = parsed.data;
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    throw new Error("Invalid reset code or email");
  }

  const resetRow = await prisma.passwordResetCode.findFirst({
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

  const codeMatches = await bcrypt.compare(data.code, resetRow.codeHash);
  if (!codeMatches) {
    throw new Error("Invalid reset code or email");
  }

  const passwordHash = await bcrypt.hash(data.newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.passwordResetCode.update({
      where: { id: resetRow.id },
      data: { consumedAt: new Date() },
    }),
    prisma.passwordResetCode.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
  ]);

  return { message: "Password reset successful. You can now log in." };
};
