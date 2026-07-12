import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";

// /api/auth/login
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { phone } = body;
  console.log("phone", phone);

  if (!phone) {
    return Response.json({ error: "Phone is required" }, { status: 400 });
  }
  console.log(process.env.DATABASE_URL);

  const user = await prisma.user.findUnique({ where: { phone } });
  console.log("user", user);

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const payload = { userId: user.id, phone: user.phone, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  return Response.json({
    accessToken,
    refreshToken,
    user: { id: user.id, phone: user.phone, name: user.name, role: user.role },
  });
}
