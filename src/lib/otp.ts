import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { OTP_TTL_MS } from "@/lib/constants";
import { AppError } from "@/lib/errors";

function generateOtp(): string {
  return randomInt(100000, 1000000).toString();
}

export async function checkOtpRateLimit(phone: string) {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 3600 * 1000);

  const recentCode = await prisma.otpCode.findFirst({
    where: { phone, createdAt: { gte: oneMinuteAgo } },
    orderBy: { createdAt: "desc" },
  });

  if (recentCode) {
    const secondsWait = Math.ceil((recentCode.createdAt.getTime() + 60000 - Date.now()) / 1000);
    throw new AppError(429, `Слишком много запросов. Попробуйте через ${secondsWait} сек.`);
  }

  const hourCodes = await prisma.otpCode.findMany({
    where: { phone, createdAt: { gte: oneHourAgo } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (hourCodes.length >= 5) {
    const oldestCode = hourCodes[4];
    const secondsWait = Math.ceil((oldestCode.createdAt.getTime() + 3600000 - Date.now()) / 1000);
    throw new AppError(429, `Слишком много запросов. Попробуйте через ${secondsWait} сек.`);
  }
}

export async function createOtpCode(phone: string): Promise<string> {
  const now = new Date();

  // Housekeeping: rows older than the 1h rate-limit window are no longer needed.
  await prisma.otpCode.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - 3600 * 1000) } },
  });

  await prisma.otpCode.updateMany({
    where: { phone, expiresAt: { gt: now } },
    data: { expiresAt: now },
  });

  const code = generateOtp();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

  await prisma.otpCode.create({ data: { phone, code, expiresAt } });

  return code;
}
