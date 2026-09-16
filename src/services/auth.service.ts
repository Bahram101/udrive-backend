import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { OTP_TTL_MS } from "@/lib/constants";
import { JwtPayload, signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/jwt";
import { Role } from "@/generated/prisma/client";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

export const AuthService = {
  async sendOtp(phone: string): Promise<{ code: string }> {
    await prisma.otpCode.deleteMany({ where: { phone } });

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await prisma.otpCode.create({ data: { phone, code, expiresAt } });

    return { code };
  },

  async verifyOtp({ phone, code, name, role }: VerifyOtpInput): Promise<AuthResult> {
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
  },

  async switchRole(userId: string): Promise<AuthResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { driver: true },
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (user.role !== "CLIENT" && user.role !== "DRIVER") {
      throw new AppError(400, "This role cannot be switched");
    }

    const activeOrder = await prisma.order.findFirst({
      where: {
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        OR: [{ clientId: userId }, { driverId: user.driver?.id }],
      },
    });

    if (activeOrder) {
      throw new AppError(400, "Нельзя сменить роль при активном заказе");
    }

    const nextRole: Role = user.role === "DRIVER" ? "CLIENT" : "DRIVER";

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        role: nextRole,
        ...(nextRole === "DRIVER" &&
          !user.driver && { driver: { create: {} } }),
      },
      include: { driver: true },
    });

    if (nextRole === "CLIENT" && updated.driver?.isOnline) {
      await prisma.driver.update({
        where: { id: updated.driver.id },
        data: { isOnline: false },
      });
    }

    return issueTokens(updated);
  },

  refreshAccessToken(refreshToken: string): { accessToken: string } {
    let payload: JwtPayload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError(401, "Invalid or expired refresh token");
    }

    const { userId, phone, role } = payload;
    return { accessToken: signAccessToken({ userId, phone, role }) };
  },
};
