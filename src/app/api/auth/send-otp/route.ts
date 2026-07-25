import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const PHONE_REGEX = /^\+7[0-9]{10}$/;

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// /api/auth/send-otp
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { phone } = body;

  if (!phone || typeof phone !== "string") {
    return Response.json({ error: "phone is required" }, { status: 400 });
  }

  if (!PHONE_REGEX.test(phone)) {
    return Response.json(
      { error: "Invalid phone number. Must be in format +7XXXXXXXXXX" },
      { status: 400 },
    );
  }

  await prisma.otpCode.deleteMany({ where: { phone } });

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.otpCode.create({ data: { phone, code, expiresAt } });

  console.log(`[OTP] Code for ${phone}: ${code}`);

  return Response.json({
    message: "OTP sent",
    ...(process.env.NODE_ENV !== "production" && { code }),
  });
}
