import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { OTP_TTL_MS } from "@/lib/constants";
import { JwtPayload, signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/jwt";
import { Role } from "@/generated/prisma/client";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOtp(phone: string): Promise<{ code: string }> {
  await prisma.otpCode.deleteMany({ where: { phone } });

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.otpCode.create({ data: { phone, code, expiresAt } });

  return { code };
}

interface VerifyOtpInput {
  phone: string;
  code: string;
  name?: string;
  role?: Role;
}

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    phone: string;
    name: string;
    role: Role;
    driver?: { id: string };
  };
}

export async function verifyOtp({ phone, code, name, role }: VerifyOtpInput): Promise<AuthResult> {
  const otpRecord = await prisma.otpCode.findFirst({
    where: { phone, code },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) {
    throw new AppError(401, "Invalid OTP code");
  }

  if (otpRecord.expiresAt < new Date()) {
    await prisma.otpCode.delete({ where: { id: otpRecord.id } });
    throw new AppError(401, "OTP code has expired");
  }

  let user = await prisma.user.findUnique({ where: { phone }, include: { driver: true } });

  if (!user) {
    if (!name || !role) {
      throw new AppError(422, "Name and role are required for new users", { isNewUser: true });
    }

    user = await prisma.user.create({
      data: {
        phone,
        name,
        role,
        ...(role === "DRIVER" && { driver: { create: {} } }),
      },
      include: { driver: true },
    });
  }

  await prisma.otpCode.delete({ where: { id: otpRecord.id } });

  return issueTokens(user);
}

export function refreshAccessToken(refreshToken: string): { accessToken: string } {
  let payload: JwtPayload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  return { accessToken: signAccessToken(payload) };
}

function issueTokens(user: {
  id: string;
  phone: string;
  name: string;
  role: Role;
  driver: { id: string } | null;
}): AuthResult {
  const payload: JwtPayload = { userId: user.id, phone: user.phone, role: user.role };

  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      ...(user.driver && { driver: { id: user.driver.id } }),
    },
  };
}
