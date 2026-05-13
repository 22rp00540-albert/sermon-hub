import { Role, UserStatus } from "@prisma/client";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";

async function run() {
  const email = process.env.ADMIN_EMAIL || "admin@church.org";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`Admin already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      fullName: "System Admin",
      email,
      passwordHash,
      country: "N/A",
      phoneNumber: "N/A",
      role: Role.ADMIN,
      status: UserStatus.APPROVED,
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
    await prisma.$disconnect();
  });
