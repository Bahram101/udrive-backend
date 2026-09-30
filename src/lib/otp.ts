import { prisma } from "@/lib/prisma";
import { OTP_TTL_MS } from "@/lib/constants";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createOtpCode(phone: string): Promise<string> {
  await prisma.otpCode.deleteMany({ where: { phone } });

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.otpCode.create({ data: { phone, code, expiresAt } });

  return code;
}
