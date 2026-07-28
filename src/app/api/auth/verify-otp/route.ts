import { NextRequest } from "next/server";
import { verifyOtpSchema } from "@/schemas/auth.schema";
import { verifyOtp } from "@/services/auth.service";
import { handleApiError } from "@/lib/errors";

// /api/auth/verify-otp
export async function POST(request: NextRequest) {
  try {
    const body = verifyOtpSchema.parse(await request.json());

    console.log("Received OTP verification request:", body);

    const result = await verifyOtp(body);

    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
