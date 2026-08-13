import { NextRequest } from "next/server";
import { sendOtpSchema } from "@/schemas/auth.schema";
import { AuthService } from "@/services/auth.service";
import { handleApiError } from "@/lib/errors";

// /api/auth/send-otp
export async function POST(request: NextRequest) {
  try {
    const { phone } = sendOtpSchema.parse(await request.json());

    const { code } = await AuthService.sendOtp(phone);

    return Response.json({
      message: "OTP sent",
      code,
      // ...(process.env.NODE_ENV !== "production" && { code }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
