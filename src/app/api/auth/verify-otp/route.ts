import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";

const PHONE_REGEX = /^\+7[0-9]{10}$/;
const SELF_REGISTERABLE_ROLES: Role[] = ["CLIENT", "DRIVER"];

// /api/auth/verify-otp
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { phone, code, name, role } = body;

  if (!phone || !code) {
    return Response.json({ error: "Phone and code are required" }, { status: 400 });
  }

  if (!PHONE_REGEX.test(phone)) {
    return Response.json({ error: "Invalid phone number" }, { status: 400 });
  }

  const otpRecord = await prisma.otpCode.findFirst({
    where: { phone, code },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) {
    return Response.json({ error: "Invalid OTP code" }, { status: 401 });
  }

  if (otpRecord.expiresAt < new Date()) {
    await prisma.otpCode.delete({ where: { id: otpRecord.id } });
    return Response.json({ error: "OTP code has expired" }, { status: 401 });
  }

  let user = await prisma.user.findUnique({ where: { phone }, include: { driver: true } });

  if (!user) {
    if (!name || !role) {
      return Response.json(
        { error: "Name and role are required for new users", isNewUser: true },
        { status: 422 },
      );
    }

    if (!SELF_REGISTERABLE_ROLES.includes(role)) {
      return Response.json({ error: "Invalid role. Must be CLIENT or DRIVER" }, { status: 400 });
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

  const payload = { userId: user.id, phone: user.phone, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  return Response.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      ...(user.driver && { driver: { id: user.driver.id } }),
    },
  });
}
