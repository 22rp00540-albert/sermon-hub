"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = require("../lib/prisma");
async function run() {
    const email = process.env.ADMIN_EMAIL || "admin@church.org";
    const password = process.env.ADMIN_PASSWORD || "admin123";
    const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (existing) {
        console.log(`Admin already exists: ${email}`);
        return;
    }
    const passwordHash = await bcrypt_1.default.hash(password, 10);
    await prisma_1.prisma.user.create({
        data: {
            fullName: "System Admin",
            email,
            passwordHash,
            country: "N/A",
            phoneNumber: "N/A",
            role: client_1.Role.ADMIN,
            status: client_1.UserStatus.APPROVED,
        },
    });
    console.log(`Admin created: ${email}`);
}
run()
    .catch((error) => {
    console.error(error);
    process.exit(1);
})
    .finally(async () => {
    await prisma_1.prisma.$disconnect();
});
